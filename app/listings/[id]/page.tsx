import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import EnquiryForm from "@/components/EnquiryForm";
import ListingGallery from "@/components/ListingGallery";
import SaveButton from "@/components/SaveButton";
import { createClient } from "@/lib/supabase/server";
import { getListing, getListingPhotos } from "@/lib/data";
import { formatUgx } from "@/lib/format";

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
};

async function ListingContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Await params INSIDE the Suspense boundary, not in the page body.
  // With Next 16 Cache Components, awaiting it in the page body is itself
  // uncached data access during prerender.
  const { id } = await params;

  // Next 16 Cache Components: stop the prerender here so the render waits
  // for a real request. Without it, Next tries to prerender this route,
  // and creating the Supabase client initialises the auth session — which
  // reads `Date.now()` to check the cookie expiry. That is an "unstable
  // value" during a prerender, and it logs an error on every visit.
  //
  // It has to come AFTER the params await. A request API has to be reached
  // first, or Next collects the page's configuration outside a request
  // scope and the build fails with "`connection` was called outside a
  // request scope".
  await connection();
  const listing = await getListing(id);

  if (!listing) notFound();

  // The photos and the ownership check are two independent reads, so they
  // run at the same time instead of one after the other.
  const [photos, owner] = await Promise.all([
    getListingPhotos(id),
    currentUserId(),
  ]);

  const posted = new Date(listing.created_at);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* The listing ------------------------------------------------ */}
      <article className="lg:col-span-7">
        <ListingGallery photos={photos} title={listing.title} />

        <div className="card card-pad mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="badge badge-brand">
                {TYPE_LABELS[listing.land_type] ?? listing.land_type}
              </span>
              {listing.status !== "active" ? (
                <span className="badge badge-neutral ml-2">{listing.status}</span>
              ) : null}
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                {listing.title}
              </h1>
              <p className="mt-3 text-3xl font-bold tracking-tight text-brand-700">
                {formatUgx(listing.price)}
              </p>
            </div>
            <SaveButton listingId={listing.id} />
          </div>

          <div className="mt-6 whitespace-pre-wrap leading-relaxed text-ink-700">
            {listing.description}
          </div>

          <dl className="mt-8 grid gap-5 border-t border-black/8 pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Location
              </dt>
              <dd className="mt-1.5 font-medium text-ink-900">
                {listing.location}, {listing.region}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Type
              </dt>
              <dd className="mt-1.5 font-medium text-ink-900 capitalize">
                {listing.land_type}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Posted
              </dt>
              <dd className="mt-1.5 font-medium text-ink-900">
                {posted.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-black/8 pt-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {(listing.seller?.full_name ?? "LF").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                {listing.seller?.full_name ?? "LandFlow member"}
              </p>
              <p className="text-xs text-ink-500">The owner of this listing</p>
            </div>
            {owner && owner === listing.seller_id ? (
              <Link
                href={`/listings/${listing.id}/photos`}
                className="btn btn-secondary btn-sm ml-auto"
              >
                Manage photos
              </Link>
            ) : null}
          </div>
        </div>
      </article>

      {/* The enquiry form -------------------------------------------- */}
      <aside className="lg:col-span-5">
        <div className="lg:sticky lg:top-20">
          {listing.status === "active" ? (
            <EnquiryForm
              listingId={listing.id}
              sellerName={listing.seller?.full_name ?? null}
            />
          ) : (
            <div className="notice notice-info">
              <span>
                This land has already been {listing.status}. It stays here so
                you can see what similar plots are going for.
              </span>
            </div>
          )}

          <div className="card card-pad mt-5">
            <h2 className="text-sm font-semibold text-ink-900">
              Before you pay anyone
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-500">
              <li>· Physically walk the boundaries with the seller.</li>
              <li>· Search the land title at the Lands office and read it.</li>
              <li>· Put every agreement in writing before you pay a deposit.</li>
              <li>· Never send money to a mobile money number you have not met.</li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function ListingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="page py-8 sm:py-12">
      <Link
        href="/"
        className="text-sm font-medium text-ink-500 transition-colors hover:text-brand-700"
      >
        &larr; Back to all listings
      </Link>
      <Suspense fallback={<div className="mt-6 h-96" />}>
        <ListingContent params={params} />
      </Suspense>
    </main>
  );
}

/**
 * The signed-in user's id, or null. Used to show owner-only controls.
 *
 * `getClaims()` reads the JWT out of the cookie and verifies it locally.
 * `getUser()` would instead ask the Auth server who the caller is — and it
 * does that by loading the session, which reads `Date.now()`. Under Next 16
 * Cache Components that is an "unstable value" during a prerender, and the
 * route logs an error on every visit.
 *
 * `getClaims()` is also faster: no network round trip. The claims are
 * signed by Supabase, so `sub` really is the user's id.
 */
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;
  return data?.claims?.sub ?? null;
}
