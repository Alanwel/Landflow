/**
 * The data access layer.
 *
 * Every function here talks to Postgres through Supabase and returns real
 * data or throws a `DataError`. There is no demo mode, no sample data and
 * no silent fallback: if the database is unreachable or a policy blocks a
 * write, the caller finds out.
 *
 * Two rules that this file exists to enforce:
 *
 *   1. A failed query is an ERROR. It never becomes fake data.
 *   2. A write that RLS filtered to zero rows is an ERROR. Postgres raises
 *      no exception in that case — the statement just affects nothing. So
 *      every write below asks for the rows it changed and complains when
 *      the answer is empty.
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DataError, unwrap, unwrapMaybe } from "@/lib/db";
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/photos";
import type {
  Listing,
  ListingFilters,
  ListingPhoto,
  ListingStatus,
  OperatorStats,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

const LISTING_COLUMNS =
  "id, title, description, price, location, region, land_type, status, seller_id, created_at";

export async function getListings(
  filters: ListingFilters = {},
): Promise<Listing[]> {
  const supabase = await createClient();

  let q = supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  if (filters.query) {
    // PostgREST `or` is one filter with several conditions, not several
    // filters — hence the single .or() call rather than three .ilike()s.
    const term = filters.query.replace(/[%,()]/g, " ").trim();
    if (term) {
      q = q.or(
        `title.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%`,
      );
    }
  }
  if (filters.region) q = q.eq("region", filters.region);
  if (filters.land_type) q = q.eq("land_type", filters.land_type);
  if (filters.max_price) q = q.lte("price", filters.max_price);

  const rows = unwrap("load listings", await q);

  return decorate(rows as Listing[]);
}

export async function getListing(id: string): Promise<Listing | null> {
  const supabase = await createClient();

  const row = unwrapMaybe(
    "load that listing",
    await supabase.from("listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle(),
  );

  if (!row) return null;

  const [withSeller] = await decorate([row as Listing]);
  return withSeller ?? null;
}

export async function getMyListings(userId: string): Promise<Listing[]> {
  const supabase = await createClient();

  const rows = unwrap(
    "load your listings",
    await supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("seller_id", userId)
      .order("created_at", { ascending: false }),
  );

  return decorate(rows as Listing[]);
}

export async function getSavedListings(userId: string): Promise<Listing[]> {
  const supabase = await createClient();

  const rows = unwrap(
    "load your saved land",
    await supabase
      .from("saved_listings")
      .select("listing_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  );

  const ids = (rows as { listing_id: string }[]).map((r) => r.listing_id);
  if (ids.length === 0) return [];

  const listings = unwrap(
    "load the land you saved",
    await supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .in("id", ids)
      .eq("status", "active"),
  );

  const order = new Map(ids.map((id, i) => [id, i]));
  const withSellers = await decorate(listings as Listing[]);
  return withSellers.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
}

async function attachSellers(listings: Listing[]): Promise<Listing[]> {
  if (listings.length === 0) return listings;

  const sellerIds = [...new Set(listings.map((l) => l.seller_id).filter(Boolean))];
  if (sellerIds.length === 0) return listings;

  const supabase = await createClient();
  const sellers = unwrap(
    "load seller details",
    await supabase
      .from("seller_public")
      .select("id, full_name, avatar_url")
      .in("id", sellerIds),
  );

  const byId = new Map(
    (sellers as { id: string; full_name: string | null; avatar_url: string | null }[]).map(
      (s) => [s.id, s],
    ),
  );

  return listings.map((l) => ({
    ...l,
    seller: byId.get(l.seller_id) ?? null,
  }));
}

/**
 * Attach the public seller info AND the cover photo to a set of listings.
 *
 * `seller_public` is a VIEW, and PostgREST can only embed a view when it can
 * prove the relationship to the base table. It usually cannot. So we read the
 * sellers in one extra query and join in JavaScript — predictable, one round
 * trip more, and it cannot silently return "no seller" for every row.
 *
 * The photos are read the same way: ONE query for every listing's photos,
 * then the first row (lowest sort_order) becomes that listing's cover. Doing
 * it per-listing would be an N+1 query — 60 extra round trips on the
 * marketplace page.
 */
export async function decorate(listings: Listing[]): Promise<Listing[]> {
  if (listings.length === 0) return listings;

  const [withSellers, coverByListing] = await Promise.all([
    attachSellers(listings),
    loadCoverPhotos(listings.map((l) => l.id)),
  ]);

  return withSellers.map((l) => ({
    ...l,
    coverUrl: coverByListing.get(l.id) ?? null,
  }));
}

/** listing id -> the URL of its first photo. */
async function loadCoverPhotos(
  listingIds: string[],
): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (listingIds.length === 0) return covers;

  const supabase = await createClient();
  const rows = unwrap(
    "load listing photos",
    await supabase
      .from("listing_photos")
      .select("listing_id, url")
      .in("listing_id", listingIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  );

  for (const row of rows as { listing_id: string; url: string }[]) {
    // First one wins — that is the cover.
    if (!covers.has(row.listing_id)) covers.set(row.listing_id, row.url);
  }

  return covers;
}

/* -------------------------------------------------------------------------- */
/* Writes — listings                                                           */
/* -------------------------------------------------------------------------- */

export async function createListing(
  userId: string,
  input: {
    title: string;
    description: string;
    price: number;
    location: string;
    region: string;
    land_type: string;
  },
): Promise<{ id: string }> {
  const supabase = await createClient();

  const rows = unwrap(
    "post your listing",
    await supabase
      .from("listings")
      .insert({
        seller_id: userId,
        title: input.title,
        description: input.description,
        price: input.price,
        location: input.location,
        region: input.region,
        land_type: input.land_type,
      })
      .select("id"),
  );

  const created = (rows as { id: string }[])[0];
  if (!created) {
    throw new DataError("Your listing could not be saved. Please try again.");
  }
  return created;
}

/**
 * Mark a listing as sold / rented, or put it back on the market.
 *
 * RLS silently filters updates it disallows, so we ask for the rows we
 * changed. An empty answer means "you do not own this" — and we say so,
 * instead of reporting a cheerful success that did nothing.
 */
export async function setListingStatus(
  userId: string,
  listingId: string,
  status: ListingStatus,
): Promise<void> {
  const supabase = await createClient();

  const rows = unwrap(
    "update your listing",
    await supabase
      .from("listings")
      .update({ status })
      .eq("id", listingId)
      .eq("seller_id", userId)
      .select("id"),
  );

  if ((rows as unknown[]).length === 0) {
    throw new DataError(
      "That listing could not be updated — you can only change land that you posted.",
      { status: 403 },
    );
  }
}

export async function deleteListing(
  userId: string,
  listingId: string,
): Promise<void> {
  const supabase = await createClient();

  const rows = unwrap(
    "remove your listing",
    await supabase
      .from("listings")
      .delete()
      .eq("id", listingId)
      .eq("seller_id", userId)
      .select("id"),
  );

  if ((rows as unknown[]).length === 0) {
    throw new DataError(
      "That listing could not be removed — you can only delete land that you posted.",
      { status: 403 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Writes — enquiries                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Send an enquiry about a piece of land.
 *
 * The database enforces the rules: the listing must exist and still be
 * active (that check lives in the RLS policy), and the buyer may be
 * logged out — a visitor who cannot sign up still deserves to ask a
 * question.
 */
export async function createEnquiry(
  input: {
    listingId: string;
    buyer_name: string;
    buyer_email: string;
    buyer_phone?: string;
    message: string;
  },
  buyerId: string | null,
): Promise<{ id: string }> {
  const supabase = await createClient();

  const rows = unwrap(
    "send your enquiry",
    await supabase
      .from("listing_enquiries")
      .insert({
        listing_id: input.listingId,
        buyer_id: buyerId,
        buyer_name: input.buyer_name,
        buyer_email: input.buyer_email,
        buyer_phone: input.buyer_phone ?? null,
        message: input.message,
      })
      .select("id"),
  );

  const created = (rows as { id: string }[])[0];
  if (!created) {
    throw new DataError(
      "Your enquiry could not be sent. Please try again in a moment.",
    );
  }
  return created;
}

/**
 * Every enquiry this user can see.
 *
 * RLS decides visibility: the seller sees enquiries on their own land, and
 * the buyer sees the enquiries they sent. We fetch both and split them here
 * so the UI can show "received" and "sent" separately.
 */
export async function getEnquiriesForUser(userId: string) {
  const supabase = await createClient();

  const rows = unwrap(
    "load enquiries",
    await supabase
      .from("listing_enquiries")
      .select(
        "id, listing_id, buyer_id, buyer_name, buyer_email, buyer_phone, message, status, created_at, listing:listings(id, title, location, region, land_type, status, seller_id)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  );

  const all = (rows as unknown as EnquiryRow[]).map(normaliseEnquiry);

  return {
    received: all.filter((e) => e.listing?.seller_id === userId),
    sent: all.filter((e) => e.buyerId === userId),
  };
}

export async function setEnquiryStatus(
  userId: string,
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
      "That enquiry could not be updated — it may not be yours to answer.",
      { status: 403 },
    );
  }
}

export async function deleteEnquiry(
  userId: string,
  enquiryId: string,
): Promise<void> {
  const supabase = await createClient();

  const rows = unwrap(
    "remove that enquiry",
    await supabase
      .from("listing_enquiries")
      .delete()
      .eq("id", enquiryId)
      .select("id"),
  );

  if ((rows as unknown[]).length === 0) {
    throw new DataError("That enquiry could not be removed.", { status: 403 });
  }
}

/* -------------------------------------------------------------------------- */
/* Writes — photos                                                             */
/* -------------------------------------------------------------------------- */

/** Every photo of one listing, in display order. */
export async function getListingPhotos(
  listingId: string,
): Promise<ListingPhoto[]> {
  const supabase = await createClient();

  const rows = unwrap(
    "load the photos",
    await supabase
      .from("listing_photos")
      .select("id, listing_id, storage_path, url, sort_order, created_at")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  );

  return (rows as PhotoRow[]).map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    storagePath: row.storage_path,
    url: row.url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }));
}

/**
 * Upload one photo for a listing and record it in the index table.
 *
 * The order of operations matters:
 *
 *   1. CHECK that the caller owns the listing, BEFORE uploading anything.
 *      Otherwise an attacker could upload files into the bucket and only
 *      fail afterwards.
 *   2. Upload to Storage, into a folder named after the user's id.
 *      The storage policy enforces the same rule, but the application
 *      checks it first so the error message is clear.
 *   3. Insert the index row.
 *   4. If the index row fails, DELETE the file again — otherwise the
 *      bucket fills up with orphans that nobody can see.
 */
export async function createListingPhoto(
  userId: string,
  listingId: string,
  file: File,
): Promise<{ id: string }> {
  if (!PHOTO_TYPES.includes(file.type)) {
    throw new DataError(
      "Upload a JPG, PNG or WebP image — that file type is not accepted.",
      { status: 400 },
    );
  }
  if (file.size > PHOTO_MAX_BYTES) {
    throw new DataError("That photo is larger than 5MB. Please shrink it.", {
      status: 400,
    });
  }

  const supabase = await createClient();

  const owned = unwrapMaybe(
    "find that listing",
    await supabase
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("seller_id", userId)
      .maybeSingle(),
  );

  if (!owned) {
    throw new DataError(
      "You can only add photos to land that you posted.",
      { status: 403 },
    );
  }

  const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${userId}/${listingId}/${crypto.randomUUID()}.${extension}`;

  const uploaded = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploaded.error) {
    throw new DataError(`Could not upload the photo: ${uploaded.error.message}`);
  }

  const { data: publicUrl } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);

  const rows = unwrap(
    "save the photo",
    await supabase
      .from("listing_photos")
      .insert({
        listing_id: listingId,
        storage_path: path,
        url: publicUrl.publicUrl,
        sort_order: 0,
      })
      .select("id"),
  );

  const created = (rows as { id: string }[])[0];
  if (!created) {
    // The file is in the bucket but nothing points at it. Clean it up.
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw new DataError("That photo could not be saved. Please try again.");
  }

  return created;
}

/**
 * Remove a photo: the index row first, then the file.
 *
 * The order is deliberate. If the file went first and the row failed to
 * delete, the listing would keep showing a broken image. If the row goes
 * first and the file delete fails, all that is left is an orphan file in
 * the bucket — invisible, harmless, and it costs nothing.
 */
export async function deleteListingPhoto(photoId: string): Promise<void> {
  const supabase = await createClient();

  const photo = unwrapMaybe<{ id: string; storage_path: string }>(
    "find that photo",
    await supabase
      .from("listing_photos")
      .select("id, storage_path")
      .eq("id", photoId)
      .maybeSingle(),
  );

  if (!photo) {
    throw new DataError("That photo could not be found.", { status: 404 });
  }

  const rows = unwrap(
    "remove that photo",
    await supabase.from("listing_photos").delete().eq("id", photoId).select("id"),
  );

  if ((rows as unknown[]).length === 0) {
    throw new DataError(
      "You can only remove photos from land that you posted.",
      { status: 403 },
    );
  }

  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
}

/* -------------------------------------------------------------------------- */
/* The operator panel                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Is this user an operator?
 *
 * The answer comes from `profiles.is_operator`, read through the RLS policy
 * "you may read your own profile row". The database is the only authority —
 * the app never keeps its own copy of the role.
 */
export async function isOperator(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const row = unwrapMaybe<{ is_operator: boolean }>(
    "check your role",
    await supabase
      .from("profiles")
      .select("is_operator")
      .eq("id", userId)
      .maybeSingle(),
  );

  return Boolean(row?.is_operator);
}

/**
 * Everything the operator panel shows.
 *
 * An operator's SELECT policies are wider than a seller's, so the SAME
 * query returns more rows for them. There is no `admin = true` parameter
 * anywhere in this file — the database decides who sees what.
 */
export async function getOperatorOverview(): Promise<{
  listings: Listing[];
  enquiries: Enquiry[];
  stats: OperatorStats;
}> {
  const supabase = await createClient();

  const [listingRows, enquiryRows, photoRows] = await Promise.all([
    supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("listing_enquiries")
      .select(
        "id, listing_id, buyer_id, buyer_name, buyer_email, buyer_phone, message, status, created_at, listing:listings(id, title, location, region, land_type, status, seller_id)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("listing_photos").select("id, listing_id"),
  ]);

  const listings = await decorate(
    unwrap("load every listing", await listingRows) as Listing[],
  );

  const enquiries = (
    unwrap("load every enquiry", await enquiryRows) as unknown as EnquiryRow[]
  ).map(normaliseEnquiry);

  const photos = unwrap("count the photos", await photoRows) as unknown[];

  const stats: OperatorStats = {
    listings: listings.length,
    active: listings.filter((l) => l.status === "active").length,
    sold: listings.filter((l) => l.status === "sold").length,
    hidden: listings.filter((l) => l.status === "hidden").length,
    enquiries: enquiries.length,
    newEnquiries: enquiries.filter((e) => e.status === "new").length,
    sellers: new Set(listings.map((l) => l.seller_id)).size,
    photos: photos.length,
  };

  return { listings, enquiries, stats };
}

/**
 * Take a listing off the market, or put it back.
 *
 * Only an operator's UPDATE policy lets this through. For anybody else
 * Postgres filters the update to zero rows and raises NO error, so we ask
 * for the rows we changed and complain when the answer is empty.
 */
export async function setListingModeration(
  listingId: string,
  hidden: boolean,
): Promise<void> {
  const supabase = await createClient();

  const rows = unwrap(
    "moderate that listing",
    await supabase
      .from("listings")
      .update({ status: hidden ? "hidden" : "active" })
      .eq("id", listingId)
      .select("id"),
  );

  if ((rows as unknown[]).length === 0) {
    throw new DataError(
      "That listing could not be updated — you may not be an operator.",
      { status: 403 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type PhotoRow = {
  id: string;
  listing_id: string;
  storage_path: string;
  url: string;
  sort_order: number;
  created_at: string;
};

export type EnquiryRow = {
  id: string;
  listing_id: string;
  buyer_id: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  message: string;
  status: "new" | "read" | "replied" | "closed";
  created_at: string;
  listing:
    | {
        id: string;
        title: string;
        location: string;
        region: string;
        land_type: string;
        status: string;
        seller_id: string;
      }
    | null;
};

export type Enquiry = {
  id: string;
  listingId: string;
  buyerId: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  message: string;
  status: "new" | "read" | "replied" | "closed";
  createdAt: string;
  listing: EnquiryRow["listing"];
};

/** PostgREST returns an embedded relation as an object OR an array. Flatten it. */
export function normaliseEnquiry(row: EnquiryRow): Enquiry {
  const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing;
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    buyerEmail: row.buyer_email,
    buyerPhone: row.buyer_phone,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    listing: listing ?? null,
  };
}
