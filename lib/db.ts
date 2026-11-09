/**
 * The single place where a Supabase response becomes either data or an error.
 *
 * WHY THIS EXISTS
 *   The first version of this app did this:
 *
 *       const { data, error } = await q;
 *       if (error || !data) return DEMO_LISTINGS.filter(...);
 *
 *   A broken query silently produced a page full of fake land. The site
 *   looked perfect and the database was on fire. Nobody could tell the
 *   difference, because the fallback *looked* like success.
 *
 *   The rule from now on: a failed query is an ERROR. It never becomes
 *   fake data. If the page cannot be built from the database, the page
 *   fails loudly and we fix the database.
 */
import "server-only";

export class DataError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { code?: string; status?: number; details?: unknown } = {},
  ) {
    super(message);
    this.name = "DataError";
    this.code = options.code ?? "DATA_ERROR";
    this.status = options.status ?? 500;
    this.details = options.details;
  }
}

/** Supabase's error shape, narrowed to what we actually use. */
type SupabaseResult<T> = {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
};

/**
 * Unwrap a Supabase result, or throw a `DataError` describing what broke.
 *
 * @param label  What was being read or written — it shows up in the error,
 *               so "listings" is far more useful than "the database".
 */
export function unwrap<T>(label: string, result: SupabaseResult<T>): T {
  if (result.error) {
    // Postgres error codes worth translating into something a human can act on.
    const code = result.error.code ?? "";
    const friendly =
      code === "42501"
        ? "You are not allowed to do that."
        : code === "23505"
          ? "That already exists."
          : code === "23503"
            ? "That record is linked to something that no longer exists."
            : result.error.message;

    throw new DataError(`Could not ${label}: ${friendly}`, {
      code: code || "DATA_ERROR",
      status: code === "42501" ? 403 : 500,
      details: result.error.details,
    });
  }

  if (result.data === null) {
    throw new DataError(`Could not ${label}: the database returned nothing.`);
  }

  return result.data;
}

/** Same as `unwrap`, but a missing row is a legitimate answer, not an error. */
export function unwrapMaybe<T>(
  label: string,
  result: SupabaseResult<T>,
): T | null {
  if (result.error) {
    const code = result.error.code ?? "";
    const friendly =
      code === "42501"
        ? "You are not allowed to do that."
        : result.error.message;
    throw new DataError(`Could not ${label}: ${friendly}`, {
      code: code || "DATA_ERROR",
      status: code === "42501" ? 403 : 500,
    });
  }
  return result.data ?? null;
}

/** Turn any thrown value into a message safe to show a user. */
export function toMessage(error: unknown, fallback: string): string {
  if (error instanceof DataError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
