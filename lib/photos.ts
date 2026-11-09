/**
 * The storage bucket and the rules about what may go in it.
 *
 * These live in their own file because two modules need them — the data
 * layer and the admin layer — and importing one from the other would make a
 * circle.
 */
export const PHOTO_BUCKET = "listing-photos";

/** The only file types the database will accept. */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** 5MB. The bucket enforces the same limit. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
