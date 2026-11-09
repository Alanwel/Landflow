import { cacheLife } from "next/cache";

/**
 * The copyright year.
 *
 * Next 16's Cache Components refuse to prerender an "unstable value" like
 * `new Date()` — it could differ between renders. But the year only changes
 * on 1 January, so caching it for as long as the platform allows is both
 * correct and the cheapest possible answer.
 */
export default async function FooterYear() {
  "use cache";
  cacheLife("max");

  return (
    <>
      &copy; {new Date().getFullYear()} LandFlow. Land for sale across Uganda.
    </>
  );
}
