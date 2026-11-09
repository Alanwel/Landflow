import Link from "next/link";

import ListingCard from "@/components/ListingCard";
import { EmptyState } from "@/components/States";
import { getListings } from "@/lib/data";
import type { ListingFilters } from "@/lib/types";

export default async function ListingGrid({
  filters,
}: {
  filters: ListingFilters;
}) {
  const listings = await getListings(filters);

  if (listings.length === 0) {
    return (
      <EmptyState
        title="No land matches those filters"
        message="Try clearing the region, widening the price, or searching for a district or town instead."
        action={
          <Link href="/" className="btn btn-secondary">
            Clear all filters
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-ink-500">
        Showing {listings.length} {listings.length === 1 ? "listing" : "listings"}
        {listings.length === 60 ? " — that is every active listing we have." : "."}
      </p>
    </>
  );
}
