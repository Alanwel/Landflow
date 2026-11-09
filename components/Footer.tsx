import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import FooterYear from "@/components/FooterYear";
import { createClient } from "@/lib/supabase/server";

const COLUMNS = [
  {
    heading: "Marketplace",
    links: [
      { href: "/", label: "Browse land" },
      { href: "/?type=agricultural", label: "Agricultural land" },
      { href: "/?type=residential", label: "Residential plots" },
      { href: "/?type=commercial", label: "Commercial land" },
      { href: "/?type=industrial", label: "Industrial land" },
    ],
  },
  {
    heading: "Sell",
    links: [
      { href: "/list-your-land", label: "Post your land" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/dashboard", label: "Your dashboard" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/saved", label: "Saved land" },
      { href: "/dashboard", label: "Enquiries" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-black/8 bg-white">
      <div className="page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
              LF
            </span>
            <span className="text-lg font-bold tracking-tight text-ink-900">
              Land<span className="text-brand-700">Flow</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-500">
            A digital land marketplace for Uganda. Browse verified titles, post
            your own land, and talk directly to the seller.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <h2 className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
              {column.heading}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {column.heading === "Account" && (
                <Suspense fallback={null}>
                  <AccountLinks />
                </Suspense>
              )}
              {column.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-700 transition-colors hover:text-brand-700"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-black/8">
        <div className="page flex flex-col gap-2 py-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <FooterYear />
          </p>
          <p>
            Every listing is posted by its owner. Always verify the title
            before you pay anyone.
          </p>
        </div>
      </div>
    </footer>
  );
}


/**
 * The Account column's session-dependent links.
 *
 * "Sign in" used to be a hardcoded constant, so a signed-in operator still
 * saw "Sign in" in the footer of every page. It reads the session on the
 * server, inside a Suspense hole, so the rest of the footer stays static.
 */
async function AccountLinks() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <li>
        <Link
          href="/login"
          className="text-sm text-ink-500 transition-colors hover:text-brand-700"
        >
          Sign in
        </Link>
      </li>
    );
  }

  return (
    <>
      <li>
        <Link
          href="/dashboard"
          className="text-sm text-ink-500 transition-colors hover:text-brand-700"
        >
          Your account
        </Link>
      </li>
      <li>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm text-ink-500 transition-colors hover:text-brand-700"
          >
            Sign out
          </button>
        </form>
      </li>
    </>
  );
}
