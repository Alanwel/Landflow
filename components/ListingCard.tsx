import Link from "next/link";

import { formatUgxShort } from "@/lib/format";
import type { Listing } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
};

export default function ListingCard({ listing }: { listing: Listing }) {
  const posted = new Date(listing.created_at);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group card card-pad flex flex-col transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
    >
      {listing.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.coverUrl}
          alt=""
          loading="lazy"
          className="mb-4 aspect-16/10 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mb-4 flex aspect-16/10 w-full items-center justify-center rounded-xl bg-sand-100 text-3xl">
          🏞️
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <span className="badge badge-brand">
          {TYPE_LABELS[listing.land_type] ?? listing.land_type}
        </span>
        {listing.status !== "active" ? (
          <span className="badge badge-neutral">{listing.status}</span>
        ) : null}
      </div>

      <h3 className="mt-4 font-semibold leading-snug text-ink-900 group-hover:text-brand-700">
        {listing.title}
      </h3>

      <p className="mt-2 text-xl font-bold tracking-tight text-brand-700">
        {formatUgxShort(listing.price)}
      </p>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-500">
        {listing.description}
      </p>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-black/8 pt-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-700">
            {listing.location}, {listing.region}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {listing.seller?.full_name ?? "LandFlow member"}
            {" · "}
            {posted.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand-700 transition-transform group-hover:translate-x-0.5">
          View →
        </span>
      </div>
    </Link>
  );
}
