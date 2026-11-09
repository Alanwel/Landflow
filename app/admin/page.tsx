import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";

import AdminEnquiryRow from "@/components/AdminEnquiryRow";
import AdminListingRow from "@/components/AdminListingRow";
import AdminUserRow from "@/components/AdminUserRow";
import { EmptyState } from "@/components/States";
import { createClient } from "@/lib/supabase/server";
import { getAdminOverview, isAdmin } from "@/lib/admin";
import { isOperator } from "@/lib/data";

export const metadata = { title: "Admin — LandFlow" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "listings", label: "Listings" },
  { key: "people", label: "People" },
  { key: "enquiries", label: "Enquiries" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * THE ADMIN PANEL
 *
 * There is no `if (admin)` in the data layer and no privileged database
 * connection anywhere in this app. The panel reads the same tables through
 * the same Supabase client the browser uses. The only difference is that
 * an admin's SELECT policies are wider — so if the database said no, this
 * page would simply be empty.
 *
 * Two roles, on purpose:
 *   operator -> moderates listings, sees every enquiry. Cannot delete.
 *   admin    -> full CRUD, plus user management and bans.
 */
async function AdminContent({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // The searchParams await happens INSIDE the Suspense boundary below,
  // not in the page body. With Next 16 Cache Components, awaiting a
  // request API in the page body is itself uncached data access, and it
  // blocks the route from being prerendered at all.
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "overview") as TabKey;

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
        <h1 className="page-title">Sign in to continue</h1>
        <p className="lede mx-auto">
          The admin panel is only for the people who run the marketplace.
        </p>
        <Link href="/login?next=/admin" className="btn btn-primary mt-7">
          Sign in
        </Link>
      </main>
    );
  }

  const admin = await isAdmin(user.id);
  const operator = await isOperator(user.id);

  if (!admin && !operator) {
    return (
      <main className="page py-20 text-center">
        <p className="eyebrow">403</p>
        <h1 className="mt-3 page-title">This area is not for you</h1>
        <p className="lede mx-auto">
          The admin panel is limited to people whose account has the operator
          or admin role. Ask the site owner if you think that is wrong.
        </p>
        <Link href="/dashboard" className="btn btn-secondary mt-7">
          Back to my dashboard
        </Link>
      </main>
    );
  }

  const { listings, enquiries, users, stats } = await getAdminOverview();

  const sellerNames = new Map(
    users.map((u) => [u.id, u.fullName ?? u.email ?? "Unknown seller"]),
  );

  const cards = [
    { label: "Listings", value: stats.listings, hint: `${stats.active} live` },
    { label: "Sold", value: stats.sold, hint: "marked as sold" },
    { label: "Hidden", value: stats.hidden, hint: "off the market" },
    {
      label: "Enquiries",
      value: stats.enquiries,
      hint: `${stats.newEnquiries} unanswered`,
    },
    { label: "People", value: stats.users, hint: `${stats.banned} suspended` },
    { label: "Photos", value: stats.photos, hint: "pictures uploaded" },
  ];

  return (
    <main className="page py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{admin ? "Admin panel" : "Operator panel"}</p>
          <h1 className="mt-3 page-title">
            {admin ? "Everything on the site" : "The whole marketplace"}
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Signed in as {user.email}
            {admin ? " · you are an admin" : " · you are an operator"}
          </p>
        </div>
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="btn btn-secondary">
            Sign out
          </button>
        </form>
      </div>

      {/* Tabs ------------------------------------------------------ */}
      <nav className="mt-8 flex flex-wrap gap-2 border-b border-black/8 pb-3">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Overview -------------------------------------------------- */}
      {tab === "overview" ? (
        <section className="mt-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className="card card-pad">
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-ink-900">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-ink-500">{card.hint}</p>
              </div>
            ))}
          </div>

          <div className="card card-pad mt-6">
            <h2 className="text-base font-bold tracking-tight text-ink-900">
              What each role can do
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                  Operator
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-700">
                  <li>· Sees every listing, in every status</li>
                  <li>· Sees every enquiry on the marketplace</li>
                  <li>· Can hide a listing and put it back</li>
                  <li className="text-ink-400">
                    ✕ Cannot delete anything
                  </li>
                  <li className="text-ink-400">
                    ✕ Cannot suspend anyone
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                  Admin
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-700">
                  <li>· Everything an operator can do</li>
                  <li>· Edits and deletes any listing, enquiry or photo</li>
                  <li>· Suspends accounts, blocks email addresses</li>
                  <li>· Deletes accounts and everything they owned</li>
                  <li className="text-ink-400">
                    ✕ Still cannot read anyone&apos;s shortlist
                  </li>
                </ul>
              </div>
            </div>
            <p className="mt-4 border-t border-black/8 pt-3 text-xs leading-relaxed text-ink-500">
              A suspension is enforced by the DATABASE, not by this page. The
              flag is read inside the row policies, so the banned user&apos;s
              existing session stops working on their very next request —
              there is no window to exploit.
            </p>
          </div>
        </section>
      ) : null}

      {/* Listings -------------------------------------------------- */}
      {tab === "listings" ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold tracking-tight text-ink-900">
            Every listing
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Correct a price, fix a typo, or take a listing off the market.
          </p>
          <div className="mt-4">
            {listings.length === 0 ? (
              <EmptyState
                title="No listings yet"
                message="Nobody has posted any land."
              />
            ) : (
              <ul className="space-y-3">
                {listings.map((listing) => (
                  <AdminListingRow
                    key={listing.id}
                    listing={listing}
                    sellerName={sellerNames.get(listing.seller_id) ?? "Unknown"}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {/* People ---------------------------------------------------- */}
      {tab === "people" ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold tracking-tight text-ink-900">
            Every account
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Change a role, suspend an account, or delete one entirely.
          </p>

          {!admin ? (
            <div className="notice notice-info mt-4">
              <span>
                You are an operator, not an admin. You can see this list, but
                changing a role or suspending an account needs the admin role.
              </span>
            </div>
          ) : null}

          <div className="mt-4">
            {users.length === 0 ? (
              <EmptyState title="No accounts yet" message="Nobody has signed up." />
            ) : (
              <ul className="space-y-3">
                {users.map((u) => (
                  <AdminUserRow key={u.id} user={u} isSelf={u.id === user.id} />
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {/* Enquiries ------------------------------------------------- */}
      {tab === "enquiries" ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold tracking-tight text-ink-900">
            Every enquiry
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Every question asked about any listing on the site.
          </p>
          <div className="mt-4">
            {enquiries.length === 0 ? (
              <EmptyState
                title="No enquiries yet"
                message="Nobody has asked about any land."
              />
            ) : (
              <ul className="space-y-3">
                {enquiries.map((enquiry) => (
                  <AdminEnquiryRow key={enquiry.id} enquiry={enquiry} />
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense fallback={<div className="page py-16" />}>
      <AdminContent searchParams={searchParams} />
    </Suspense>
  );
}
