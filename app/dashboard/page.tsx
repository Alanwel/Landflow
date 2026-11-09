import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";

import EnquiryActions from "@/components/EnquiryActions";
import ListingRowActions from "@/components/ListingRowActions";
import { EmptyState } from "@/components/States";
import { createClient } from "@/lib/supabase/server";
import { getEnquiriesForUser, getMyListings, isOperator } from "@/lib/data";
import { formatUgxShort } from "@/lib/format";
import type { Enquiry } from "@/lib/data";

export const metadata = { title: "Your dashboard — LandFlow" };

async function DashboardContent({
  posted,
}: {
  posted: boolean;
}) {
  // Next 16 Cache Components: these pages depend on WHO IS SIGNED IN.
  // `connection()` stops the prerender here, so the render waits for a
  // real request. Without it Next tries to prerender the route, and
  // supabase-ssr reads `Date.now()` inside the cookie session check —
  // which is an "unstable value" during a prerender.
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="page py-20 text-center">
        <h1 className="page-title">Sign in to manage your land</h1>
        <p className="lede mx-auto">
          Your listings and your enquiries live here.
        </p>
        <Link
          href="/login?next=/dashboard"
          className="btn btn-primary mt-7"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const [listings, enquiries, operator] = await Promise.all([
    getMyListings(user.id),
    getEnquiriesForUser(user.id),
    isOperator(user.id),
  ]);

  const unanswered = enquiries.received.filter((e) => e.status === "new").length;

  return (
    <main className="page py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your dashboard</p>
          <h1 className="mt-3 page-title">Land you manage</h1>
          <p className="mt-2 text-sm text-ink-500">Signed in as {user.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {operator ? (
            <Link href="/operator" className="btn btn-secondary">
              Operator panel
            </Link>
          ) : null}
          <Link href="/list-your-land" className="btn btn-primary">
            Post more land
          </Link>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="btn btn-secondary">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {posted ? (
        <div className="notice notice-success mt-6">
          <span>Your land is live. Buyers can find it and send you enquiries.</span>
        </div>
      ) : null}

      {/* Enquiries received ----------------------------------------- */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-ink-900">
            Enquiries on your land
            {unanswered > 0 ? (
              <span className="ml-2 badge badge-brand">{unanswered} new</span>
            ) : null}
          </h2>
          <p className="text-sm text-ink-500">
            {enquiries.received.length} total
          </p>
        </div>

        <div className="mt-4">
          {enquiries.received.length === 0 ? (
            <EmptyState
              title="No enquiries yet"
              message="When someone asks about a piece of land you posted, their message lands here."
            />
          ) : (
            <ul className="space-y-4">
              {enquiries.received.map((enquiry) => (
                <EnquiryCard
                  key={enquiry.id}
                  enquiry={enquiry}
                  perspective="seller"
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* My listings ------------------------------------------------ */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-ink-900">
            Your listings
          </h2>
          <p className="text-sm text-ink-500">{listings.length} total</p>
        </div>

        <div className="mt-4">
          {listings.length === 0 ? (
            <EmptyState
              title="You have not posted any land yet"
              message="Post a listing and buyers in your region will find it."
              action={
                <Link href="/list-your-land" className="btn btn-primary">
                  Post your land
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-black/8 overflow-hidden rounded-2xl border border-black/10 bg-white">
              {listings.map((listing) => (
                <li
                  key={listing.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="font-semibold text-ink-900 hover:text-brand-700"
                    >
                      {listing.title}
                    </Link>
                    <p className="mt-1 text-xs text-ink-500">
                      {listing.location} · {listing.region} ·{" "}
                      <span className="capitalize">{listing.status}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-brand-700">
                      {formatUgxShort(listing.price)}
                    </span>
                    <Link
                      href={`/listings/${listing.id}/photos`}
                      className="btn btn-sm btn-secondary"
                      title="Add or remove photos of this land"
                    >
                      Photos
                    </Link>
                    <ListingRowActions
                      listingId={listing.id}
                      currentStatus={listing.status}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Enquiries sent ---------------------------------------------- */}
      {enquiries.sent.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-ink-900">
            Enquiries you have sent
          </h2>
          <ul className="mt-4 space-y-4">
            {enquiries.sent.map((enquiry) => (
              <EnquiryCard key={enquiry.id} enquiry={enquiry} perspective="buyer" />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function EnquiryCard({
  enquiry,
  perspective,
}: {
  enquiry: Enquiry;
  perspective: "seller" | "buyer";
}) {
  const received = new Date(enquiry.createdAt);

  return (
    <li className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {enquiry.listing ? (
            <Link
              href={`/listings/${enquiry.listingId}`}
              className="font-semibold text-ink-900 hover:text-brand-700"
            >
              {enquiry.listing.title}
            </Link>
          ) : (
            <p className="font-semibold text-ink-500">A listing you cannot see</p>
          )}
          <p className="mt-1 text-xs text-ink-500">
            {perspective === "seller" ? "From" : "To"}{" "}
            <span className="font-medium text-ink-700">{enquiry.buyerName}</span>
            {" · "}
            <a
              href={`mailto:${enquiry.buyerEmail}`}
              className="hover:text-brand-700 hover:underline"
            >
              {enquiry.buyerEmail}
            </a>
            {enquiry.buyerPhone ? (
              <>
                {" · "}
                <a
                  href={`tel:${enquiry.buyerPhone.replace(/\s/g, "")}`}
                  className="hover:text-brand-700 hover:underline"
                >
                  {enquiry.buyerPhone}
                </a>
              </>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 text-xs text-ink-500">
          {received.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      <p className="mt-4 whitespace-pre-wrap leading-relaxed text-ink-700">
        {enquiry.message}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-4">
        <span className="text-xs text-ink-500">
          {perspective === "seller"
            ? "Reply by email — the buyer is waiting."
            : "You will be able to see the seller's reply by email."}
        </span>
        <EnquiryActions
          enquiryId={enquiry.id}
          currentStatus={enquiry.status}
          mode={perspective}
        />
      </div>
    </li>
  );
}

export default function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string }>;
}) {
  return (
    <Suspense fallback={<div className="page py-12" />}>
      <DashboardResolver searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardResolver({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string }>;
}) {
  const sp = await searchParams;
  return <DashboardContent posted={sp.posted === "1"} />;
}
