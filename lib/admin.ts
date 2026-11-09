/**
 * The admin panel's data layer.
 *
 * The important thing to understand about this file: it contains NO privilege
 * checks. There is no `if (admin)` anywhere. Every function here does the
 * same thing — it asks the database to do something and then verifies that
 * the database actually did it.
 *
 * That is deliberate. If the check lived in the app, then:
 *   - a bug in the app would let a normal user through, and
 *   - the database would still be the thing that decides the answer.
 *
 * With the check in the database, the app is just a remote control.
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DataError, unwrap, unwrapMaybe } from "@/lib/db";
import { PHOTO_BUCKET } from "@/lib/photos";
import { decorate, normaliseEnquiry } from "@/lib/data";
import type { Enquiry, EnquiryRow } from "@/lib/data";
import type {
  AdminStats,
  AdminUser,
  Listing,
  ListingStatus,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/** Is this user the site owner? */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const row = unwrapMaybe<{ is_admin: boolean }>(
    "check your role",
    await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle(),
  );

  return Boolean(row?.is_admin);
}

/**
 * Everything the admin panel shows.
 *
 * An admin's SELECT policies are wider than a seller's, so the SAME query
 * returns more rows for them. There is no `admin = true` parameter
 * anywhere in this file — the database decides who sees what.
 */
export async function getAdminOverview(): Promise<{
  listings: Listing[];
  enquiries: Enquiry[];
  users: AdminUser[];
  stats: AdminStats;
}> {
  const supabase = await createClient();

  const [listingRows, enquiryRows, photoRows, userRows] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, description, price, location, region, land_type, status, seller_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("listing_enquiries")
      .select(
        "id, listing_id, buyer_id, buyer_name, buyer_email, buyer_phone, message, status, created_at, listing:listings(id, title, location, region, land_type, status, seller_id)",
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("listing_photos").select("id, listing_id"),
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, is_operator, is_admin, is_banned, banned_reason, banned_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const listings = await decorate(
    unwrap("load every listing", await listingRows) as Listing[],
  );

  const enquiries = (
    unwrap("load every enquiry", await enquiryRows) as unknown as EnquiryRow[]
  ).map(normaliseEnquiry);

  const photos = unwrap("count the photos", await photoRows) as unknown[];

  const profiles = unwrap("load every user", await userRows) as ProfileRow[];

  // The counts are worked out in JavaScript rather than in SQL. With a
  // few hundred rows that is instant, and it avoids a second round trip
  // and a set of joins that would have to be kept correct.
  const listingCount = new Map<string, number>();
  for (const listing of listings) {
    listingCount.set(
      listing.seller_id,
      (listingCount.get(listing.seller_id) ?? 0) + 1,
    );
  }

  const enquiryCount = new Map<string, number>();
  for (const enquiry of enquiries) {
    if (!enquiry.buyerId) continue;
    enquiryCount.set(
      enquiry.buyerId,
      (enquiryCount.get(enquiry.buyerId) ?? 0) + 1,
    );
  }

  const users: AdminUser[] = profiles.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    isOperator: row.is_operator,
    isAdmin: row.is_admin,
    isBanned: row.is_banned,
    bannedReason: row.banned_reason,
    bannedAt: row.banned_at,
    createdAt: row.created_at,
    listingCount: listingCount.get(row.id) ?? 0,
    enquiryCount: enquiryCount.get(row.id) ?? 0,
  }));

  const stats: AdminStats = {
    listings: listings.length,
    active: listings.filter((l) => l.status === "active").length,
    sold: listings.filter((l) => l.status === "sold").length,
    hidden: listings.filter((l) => l.status === "hidden").length,
    enquiries: enquiries.length,
    newEnquiries: enquiries.filter((e) => e.status === "new").length,
    sellers: new Set(listings.map((l) => l.seller_id)).size,
    photos: photos.length,
    users: users.length,
    banned: users.filter((u) => u.isBanned).length,
  };

  return { listings, enquiries, users, stats };
}

/* -------------------------------------------------------------------------- */
/* Writes — listings                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Edit any listing. An admin can correct a typo, fix a price, or move a
 * listing to another region.
 *
 * Every write asks for the rows it changed. RLS filters a blocked update to
 * zero rows and raises NO error, so an empty answer is the only proof that
 * something went wrong.
 */
export async function adminUpdateListing(
  listingId: string,
  patch: {
    title?: string;
    description?: string;
    price?: number;
    location?: string;
    region?: string;
    land_type?: string;
    status?: ListingStatus;
  },
): Promise<void> {
  const supabase = await createClient();

  const rows = unwrap(
    "update that listing",
    await supabase.from("listings").update(patch).eq("id", listingId).select("id"),
  );

  if ((rows as unknown[]).length === 0) {
    throw new DataError(
      "That listing could not be updated — you may not be an admin.",
      { status: 403 },
    );
  }
}

/**
 * Delete a listing for good, together with its photos and enquiries.
 *
 * The database cascades: deleting the listing row removes its photos and
 * its enquiries. But the FILES in Storage do not cascade — Postgres does
 * not know about the bucket. So they are deleted here, first, and the row
 * is deleted second. If the row delete fails you are left with a few
 * orphan files, which is much better than a listing with broken images.
 */
export async function adminDeleteListing(listingId: string): Promise<void> {
  const supabase = await createClient();

  // 1. the files
  const photos = unwrap(
    "find the photos of that listing",
    await supabase
      .from("listing_photos")
      .select("storage_path")
      .eq("listing_id", listingId),
  ) as { storage_path: string }[];

  if (photos.length > 0) {
    await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(photos.map((p) => p.storage_path));
  }

  // 2. the row (photos and enquiries cascade from here)
  const rows = unwrap(
    "delete that listing",
    await supabase.from("listings").delete().eq("id", listingId).select("id"),
  );

  if ((rows as unknown[]).length === 0) {
    throw new DataError(
      "That listing could not be deleted — you may not be an admin.",
      { status: 403 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Writes — enquiries                                                          */
/* -------------------------------------------------------------------------- */

export async function adminSetEnquiryStatus(
  enquiryId: string,
  status: "new" | "read" | "replied" | "closed",
): Promise<void> {
  const supabase = await createClient();

  const rows = unwrap(
    "update that enquiry",
    await supabase
      .from("listing_enquiries")
      .update({ status })
      .eq("id", enquiryId)
      .select("id"),
  );

  if ((rows as unknown[]).length === 0) {
    throw new DataError(
      "That enquiry could not be updated — you may not be an admin.",
      { status: 403 },
    );
  }
}

export async function adminDeleteEnquiry(enquiryId: string): Promise<void> {
  const supabase = await createClient();

  const rows = unwrap(
    "delete that enquiry",
    await supabase.from("listing_enquiries").delete().eq("id", enquiryId).select("id"),
  );

  if ((rows as unknown[]).length === 0) {
    throw new DataError(
      "That enquiry could not be deleted — you may not be an admin.",
      { status: 403 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Writes — users                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Give or take the operator / admin roles.
 *
 * This one goes through a SECURITY DEFINER function rather than a plain
 * table update, and that is not decoration. The column-level grant means
 * `authenticated` cannot touch `is_admin` or `is_operator` AT ALL — so the
 * ONLY door to those columns is the function, and the function checks
 * `is_admin()` itself before doing anything.
 */
export async function adminSetRole(
  userId: string,
  isOperator: boolean,
  isAdmin: boolean,
): Promise<void> {
  const supabase = await createClient();

  unwrapMaybe(
    "change that role",
    await supabase.rpc("admin_set_role", {
      p_user_id: userId,
      p_is_operator: isOperator,
      p_is_admin: isAdmin,
    }),
  );
}

/**
 * Suspend or restore an account.
 *
 * The ban is enforced by the DATABASE: the flag is read inside the RLS
 * policies, so the banned user's existing JWT stops granting them anything
 * on their very next request.
 */
export async function adminSetBan(
  userId: string,
  banned: boolean,
  reason?: string,
  blockEmail = false,
): Promise<void> {
  const supabase = await createClient();

  unwrapMaybe(
    "change that ban",
    await supabase.rpc("admin_set_ban", {
      p_user_id: userId,
      p_banned: banned,
      p_reason: reason ?? null,
      p_block_email: blockEmail,
    }),
  );
}

/**
 * Delete an account: their profile goes, which cascades away their
 * listings, those listings' photos and their enquiries. Their email is
 * blocked so they cannot sign up again with the same address.
 */
export async function adminDeleteUser(userId: string): Promise<void> {
  const supabase = await createClient();

  // Their listing photos have to go from Storage first — a cascading
  // DELETE in Postgres does not touch the bucket.
  const photos = unwrap(
    "find that user's photos",
    await supabase
      .from("listing_photos")
      .select("storage_path, listing:listings(seller_id)")
      .eq("listing:seller_id", userId),
  ) as { storage_path: string }[];

  if (photos.length > 0) {
    await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(photos.map((p) => p.storage_path));
  }

  unwrapMaybe(
    "delete that account",
    await supabase.rpc("admin_delete_user", { p_user_id: userId }),
  );
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_operator: boolean;
  is_admin: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  banned_at: string | null;
  created_at: string;
};

