/**
 * Every form on the site is validated HERE, on the server.
 *
 * A Server Action is a public POST endpoint. A browser can send anything to
 * it, with or without going through the UI. So the rules that protect the
 * database have to live next to the database, not in the `<form>`.
 *
 * The `required` attribute on an input is a convenience for the person
 * typing. It is not a security control.
 */
import { z } from "zod";

import { LAND_TYPES, REGIONS } from "./types";

const landTypeEnum = z.enum(LAND_TYPES);
const regionEnum = z.enum(REGIONS);

/** Ugandan mobile numbers, loosely. */
const phoneRegex = /^[+()0-9\s-]{6,20}$/;

export const listingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(8, "Give the listing a clear title (at least 8 characters)")
    .max(120, "Keep the title under 120 characters"),
  description: z
    .string()
    .trim()
    .min(20, "Describe the land — buyers need to know the size, access and title")
    .max(4000, "Keep the description under 4000 characters"),
  price: z.coerce
    .number({ message: "Enter the asking price" })
    .int("The price must be a whole number of shillings")
    .positive("The price must be greater than zero")
    .max(9_000_000_000_000, "That price looks too large — check the figure"),
  location: z
    .string()
    .trim()
    .min(3, "Say where the land is")
    .max(120, "Keep the location under 120 characters"),
  region: regionEnum,
  land_type: landTypeEnum,
});

export type ListingInput = z.infer<typeof listingSchema>;

export const enquirySchema = z.object({
  listingId: z.string().uuid("That listing reference is not valid"),
  buyer_name: z
    .string()
    .trim()
    .min(2, "Tell the seller your name")
    .max(120, "That name is too long"),
  buyer_email: z
    .string()
    .trim()
    .email("Enter a valid email address so the seller can reply"),
  buyer_phone: z
    .string()
    .trim()
    .refine((v) => v === "" || phoneRegex.test(v), "Enter a valid phone number")
    .optional()
    .transform((v) => (v ? v : undefined)),
  message: z
    .string()
    .trim()
    .min(10, "Ask the seller something — at least 10 characters")
    .max(2000, "Keep the message under 2000 characters"),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

export const enquiryStatusSchema = z.enum(["new", "read", "replied", "closed"]);

/**
 * Flatten a Zod error into `{ field: message }` so a form can put the
 * message next to the input that caused it.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
