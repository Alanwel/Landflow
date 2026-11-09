"use server";

/**
 * Every write in LandFlow happens here.
 *
 * A Server Action is reachable by ANY POST request, not just the one our own
 * form sends. The docs are explicit: "treat every action as an untrusted
 * entry point". So each action below:
 *
 *   1. signs the user in again (the cookie is the only proof of identity),
 *   2. validates every field on the server (the HTML `required` attribute is
 *      a convenience for the typist, not a control),
 *   3. lets the DATABASE do the authorising — RLS decides whether this user
 *      may write this row,
 *   4. revalidates the affected paths so the page re-renders with new data.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { DataError, toMessage } from "@/lib/db";
import {
  adminDeleteEnquiry,
  adminDeleteListing,
  adminDeleteUser,
  adminSetBan,
  adminSetEnquiryStatus,
  adminSetRole,
  adminUpdateListing,
  isAdmin,
} from "@/lib/admin";
import {
  createListing,
  createEnquiry,
  createListingPhoto,
  deleteEnquiry,
  deleteListing,
  deleteListingPhoto,
  setEnquiryStatus,
  setListingModeration,
  setListingStatus,
} from "@/lib/data";
import {
  enquirySchema,
  enquiryStatusSchema,
  fieldErrors,
  listingSchema,
} from "@/lib/validation";
import type { ListingStatus } from "@/lib/types";
import type { FormState } from "@/lib/form-state";

function fail(message: string, errors: Record<string, string> = {}): FormState {
  return { status: "error", message, fieldErrors: errors };
}

/** The signed-in user, or a redirect to the login page. */
async function requireUser(next: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/* -------------------------------------------------------------------------- */
/* Listings                                                                    */
/* -------------------------------------------------------------------------- */

export async function createListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/list-your-land");

  const parsed = listingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    location: formData.get("location"),
    region: formData.get("region"),
    land_type: formData.get("land_type"),
  });

  if (!parsed.success) {
    return fail("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  try {
    await createListing(user.id, parsed.data);
  } catch (error) {
    return fail(toMessage(error, "Your listing could not be posted."));
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect("/dashboard?posted=1");
}

export async function setListingStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/dashboard");

  const listingId = String(formData.get("listingId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!listingId || !["active", "sold", "rented"].includes(status)) {
    return fail("That request was not valid.");
  }

  try {
    await setListingStatus(user.id, listingId, status as ListingStatus);
  } catch (error) {
    return fail(toMessage(error, "That listing could not be updated."));
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath(`/listings/${listingId}`);
  return { status: "success", message: "Listing updated.", fieldErrors: {} };
}

export async function deleteListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/dashboard");

  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return fail("That request was not valid.");

  try {
    await deleteListing(user.id, listingId);
  } catch (error) {
    return fail(toMessage(error, "That listing could not be removed."));
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  return { status: "success", message: "Listing removed.", fieldErrors: {} };
}

/* -------------------------------------------------------------------------- */
/* Photos                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Upload a photo for one of your listings.
 *
 * The file arrives inside the FormData — a browser sends multipart bodies
 * when the <form> has `encType="multipart/form-data"`. The file is NOT
 * trusted: the type and the size are checked here, the bucket has the same
 * limits, and the ownership of the listing is checked before a single byte
 * is stored.
 */
export async function uploadListingPhotoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return fail("That request was not valid.");

  const user = await requireUser(`/listings/${listingId}/photos`);

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose a photo to upload.");
  }

  try {
    await createListingPhoto(user.id, listingId, file);
  } catch (error) {
    return fail(toMessage(error, "That photo could not be uploaded."));
  }

  revalidatePath(`/listings/${listingId}`);
  revalidatePath(`/listings/${listingId}/photos`);
  revalidatePath("/");
  revalidatePath("/operator");
  return { status: "success", message: "Photo added.", fieldErrors: {} };
}

export async function deleteListingPhotoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const photoId = String(formData.get("photoId") ?? "");
  if (!photoId) return fail("That request was not valid.");

  await requireUser("/dashboard");

  try {
    await deleteListingPhoto(photoId);
  } catch (error) {
    return fail(toMessage(error, "That photo could not be removed."));
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/operator");
  return { status: "success", message: "Photo removed.", fieldErrors: {} };
}

/* -------------------------------------------------------------------------- */
/* Operator                                                                    */
/* -------------------------------------------------------------------------- */

export async function setListingModerationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser("/operator");

  const listingId = String(formData.get("listingId") ?? "");
  const hidden = String(formData.get("hidden")) === "true";
  if (!listingId) return fail("That request was not valid.");

  try {
    await setListingModeration(listingId, hidden);
  } catch (error) {
    return fail(toMessage(error, "That listing could not be updated."));
  }

  revalidatePath("/");
  revalidatePath("/operator");
  revalidatePath("/dashboard");
  return {
    status: "success",
    message: hidden ? "Listing hidden." : "Listing is live again.",
    fieldErrors: {},
  };
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Is the signed-in user an admin?
 *
 * This is a COURTESY check, not a security check. It stops the page from
 * rendering a form that would fail anyway, and it gives a friendly message
 * instead of a 42501 from Postgres.
 *
 * The SECURITY comes from the other end: the RLS policies and the
 * SECURITY DEFINER functions both check `is_admin()` themselves. If this
 * function were deleted tomorrow, nothing would become accessible that
 * was not already accessible — it would only become less pleasant to use.
 */
async function requireAdmin(next: string) {
  const user = await requireUser(next);
  const admin = await isAdmin(user.id);
  if (!admin) {
    throw new DataError("This area is for site admins only.", { status: 403 });
  }
  return user;
}

export async function adminUpdateListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin");

  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return fail("That request was not valid.");

  const patch: Record<string, string | number> = {};

  const title = String(formData.get("title") ?? "").trim();
  if (title) patch.title = title.slice(0, 120);

  const price = Number(formData.get("price"));
  if (Number.isFinite(price) && price > 0) patch.price = Math.round(price);

  const location = String(formData.get("location") ?? "").trim();
  if (location) patch.location = location.slice(0, 120);

  const region = String(formData.get("region") ?? "").trim();
  if (region) patch.region = region;

  const landType = String(formData.get("land_type") ?? "").trim();
  if (landType) patch.land_type = landType;

  const status = String(formData.get("status") ?? "").trim();
  if (["active", "sold", "rented", "hidden"].includes(status)) patch.status = status;

  const description = String(formData.get("description") ?? "").trim();
  if (description) patch.description = description.slice(0, 4000);

  if (Object.keys(patch).length === 0) return fail("Nothing was changed.");

  try {
    await adminUpdateListing(listingId, patch);
  } catch (error) {
    return fail(toMessage(error, "That listing could not be updated."));
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath(`/listings/${listingId}`);
  return { status: "success", message: "Listing updated.", fieldErrors: {} };
}

export async function adminDeleteListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin");

  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return fail("That request was not valid.");

  try {
    await adminDeleteListing(listingId);
  } catch (error) {
    return fail(toMessage(error, "That listing could not be deleted."));
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { status: "success", message: "Listing deleted.", fieldErrors: {} };
}

export async function adminSetEnquiryStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin");

  const enquiryId = String(formData.get("enquiryId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!enquiryId || !["new", "read", "replied", "closed"].includes(status)) {
    return fail("That request was not valid.");
  }

  try {
    await adminSetEnquiryStatus(
      enquiryId,
      status as "new" | "read" | "replied" | "closed",
    );
  } catch (error) {
    return fail(toMessage(error, "That enquiry could not be updated."));
  }

  revalidatePath("/admin");
  return { status: "success", message: "Enquiry updated.", fieldErrors: {} };
}

export async function adminDeleteEnquiryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin");

  const enquiryId = String(formData.get("enquiryId") ?? "");
  if (!enquiryId) return fail("That request was not valid.");

  try {
    await adminDeleteEnquiry(enquiryId);
  } catch (error) {
    return fail(toMessage(error, "That enquiry could not be deleted."));
  }

  revalidatePath("/admin");
  return { status: "success", message: "Enquiry deleted.", fieldErrors: {} };
}

export async function adminSetRoleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin");

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return fail("That request was not valid.");

  const isOperator = formData.get("isOperator") === "true";
  const isAdmin = formData.get("isAdmin") === "true";

  try {
    await adminSetRole(userId, isOperator, isAdmin);
  } catch (error) {
    return fail(toMessage(error, "That role could not be changed."));
  }

  revalidatePath("/admin");
  return { status: "success", message: "Role updated.", fieldErrors: {} };
}

export async function adminSetBanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin");

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return fail("That request was not valid.");

  const banned = formData.get("banned") === "true";
  const reason = String(formData.get("reason") ?? "").trim();
  const blockEmail = formData.get("blockEmail") === "true";

  try {
    await adminSetBan(userId, banned, reason || undefined, blockEmail);
  } catch (error) {
    return fail(toMessage(error, "That account could not be updated."));
  }

  revalidatePath("/admin");
  return {
    status: "success",
    message: banned ? "Account suspended." : "Account restored.",
    fieldErrors: {},
  };
}

export async function adminDeleteUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin");

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return fail("That request was not valid.");

  try {
    await adminDeleteUser(userId);
  } catch (error) {
    return fail(toMessage(error, "That account could not be deleted."));
  }

  revalidatePath("/admin");
  return { status: "success", message: "Account deleted.", fieldErrors: {} };
}

/* -------------------------------------------------------------------------- */
/* Enquiries                                                                   */
/* -------------------------------------------------------------------------- */

export async function sendEnquiryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = enquirySchema.safeParse({
    listingId: formData.get("listingId"),
    buyer_name: formData.get("buyer_name"),
    buyer_email: formData.get("buyer_email"),
    buyer_phone: formData.get("buyer_phone") ?? "",
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return fail("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  // A signed-in buyer gets their enquiry tied to their account, so they can
  // track it. A visitor who is not signed in can still ask — they simply do
  // not get the "sent" list.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    await createEnquiry(parsed.data, user?.id ?? null);
  } catch (error) {
    return fail(
      toMessage(error, "Your enquiry could not be sent. Please try again."),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/listings/${parsed.data.listingId}`);
  return {
    status: "success",
    message: "Your enquiry has been sent to the seller.",
    fieldErrors: {},
  };
}

export async function setEnquiryStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/dashboard");

  const enquiryId = String(formData.get("enquiryId") ?? "");
  const status = enquiryStatusSchema.safeParse(formData.get("status"));
  if (!enquiryId || !status.success) return fail("That request was not valid.");

  try {
    await setEnquiryStatus(user.id, enquiryId, status.data);
  } catch (error) {
    return fail(toMessage(error, "That enquiry could not be updated."));
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Enquiry updated.", fieldErrors: {} };
}

export async function deleteEnquiryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/dashboard");

  const enquiryId = String(formData.get("enquiryId") ?? "");
  if (!enquiryId) return fail("That request was not valid.");

  try {
    await deleteEnquiry(user.id, enquiryId);
  } catch (error) {
    return fail(toMessage(error, "That enquiry could not be removed."));
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Enquiry removed.", fieldErrors: {} };
}
