import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import FilterBar from "@/components/FilterBar";
import ListingGrid from "@/components/ListingGrid";
import { CardSkeleton } from "@/components/States";
import { LAND_TYPES, REGIONS, type ListingFilters } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
};

const TYPE_BLURBS: Record<string, string> = {
  residential: "Homes, homesteads and building plots in growing towns.",
  commercial: "Shops, offices and mixed-use space on busy roads.",
  agricultural: "Farms, plantations and grazing land with real acreage.",
  industrial: "Warehouses, workshops and land for heavy industry.",
};

export default function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      {/* Hero ------------------------------------------------------- */}
      <section className="border-b border-black/8 bg-white">
        <div className="page grid gap-10 py-14 sm:py-20 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="eyebrow">Land for sale in Uganda</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl lg:text-6xl lg:leading-[1.05]">
              Find the right land.
              <br />
              <span className="text-brand-700">Talk to the owner.</span>
            </h1>
            <p className="lede">
              Plots, farms and commercial land across every region of Uganda —
              listed by the people who own them. Browse without an account, save
              what you like, and send your questions straight to the seller.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#listings" className="btn btn-primary">
                Browse land
              </a>
              <Link href="/list-your-land" className="btn btn-secondary">
                Post your land
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-500">
              <li>No fees to browse</li>
              <li>·</li>
              <li>No middlemen</li>
              <li>·</li>
              <li>Direct to the seller</li>
            </ul>
          </div>

          <div className="lg:col-span-5">
            <div className="card card-pad">
              <h2 className="text-sm font-semibold text-ink-900">
                Browse by type of land
              </h2>
              <ul className="mt-4 divide-y divide-black/8">
                {LAND_TYPES.map((type) => (
                  <li key={type}>
                    <Link
                      href={`/?type=${type}`}
                      className="group flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <span>
                        <span className="block font-medium text-ink-900 group-hover:text-brand-700">
                          {TYPE_LABELS[type]}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-500">
                          {TYPE_BLURBS[type]}
                        </span>
                      </span>
                      <span className="mt-1 shrink-0 text-brand-700">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* The marketplace -------------------------------------------- */}
      <section id="listings" className="page scroll-mt-20 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The marketplace</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              All land for sale
            </h2>
          </div>
        </div>

        <div className="mt-6">
          <Suspense
            fallback={
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            }
          >
            <Marketplace searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      {/* How it works ------------------------------------------------ */}
      <section className="border-y border-black/8 bg-white">
        <div className="page py-14">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Three steps, no agents in the middle
          </h2>

          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Browse and filter",
                body: "Search by region, type and price. Save anything you want to come back to.",
              },
              {
                n: "02",
                title: "Ask the seller",
                body: "Send an enquiry from the listing. It goes straight to the owner's email — no forms in the dark.",
              },
              {
                n: "03",
                title: "View the land",
                body: "Agree a time, walk the boundaries, and check the title before you pay a shilling.",
              },
            ].map((step) => (
              <li key={step.n} className="card card-pad">
                <span className="font-mono text-sm font-bold text-brand-600">
                  {step.n}
                </span>
                <h3 className="mt-3 font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Selling CTA -------------------------------------------------- */}
      <section className="page py-14">
        <div className="card overflow-hidden">
          <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="eyebrow">For landowners</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                List your land for free
              </h2>
              <p className="mt-3 max-w-lg leading-relaxed text-ink-500">
                Post once and buyers come to you. You decide who to reply to
                and when. LandFlow takes no commission and no listing fee.
              </p>
              <Link href="/list-your-land" className="btn btn-primary mt-7">
                Post your land
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              {REGIONS.slice(0, 6).map((region) => (
                <div key={region} className="rounded-xl bg-sand-100 px-4 py-3">
                  <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                    Region
                  </dt>
                  <dd className="mt-1 font-semibold text-ink-900">{region}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * The filters and the grid.
 *
 * `searchParams` is a request read, so it can only be awaited inside the
 * <Suspense> boundary in the page above — never in the page body. That is
 * what lets the hero above paint instantly while the listings stream in.
 */
async function Marketplace({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // Next 16 Cache Components: the listings are live data, and the nav
  // checks who is signed in. `connection()` stops the prerender here so
  // the render waits for a real request.
  //
  // It has to be called AFTER the `searchParams` await. A request API has
  // to be reached first, or Next collects the page's configuration
  // outside a request scope and the build fails with
  // "`connection` was called outside a request scope".
  await connection();

  const filters: ListingFilters = {
    query: first(sp.q) || undefined,
    region: first(sp.region) || undefined,
    land_type: first(sp.type) || undefined,
    max_price: first(sp.max) ? Number(first(sp.max)) : undefined,
  };

  return (
    <>
      <FilterBar />
      <div className="mt-6">
        <ListingGrid filters={filters} />
      </div>
    </>
  );
}
