"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LinkItem = { href: string; label: string };

type Props = {
  links: LinkItem[];
  /** Who is signed in, decided on the server. */
  signedIn: boolean;
  isAdmin: boolean;
  isOperator: boolean;
};

/**
 * The mobile drawer.
 *
 * It used to render a hardcoded "Sign in" link, because it had no idea who
 * was signed in — it is a client component and the session lives in a
 * cookie. So a signed-in operator still saw "Sign in" on their phone, and
 * could not sign out from the menu at all.
 *
 * The session state now comes in as props from the server component that
 * already reads it, so the menu tells the truth.
 */
export default function MobileNav({ links, signedIn, isAdmin, isOperator }: Props) {
  const [open, setOpen] = useState(false);

  // Lock the page behind the drawer so the background does not scroll.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 text-ink-700 hover:bg-black/5"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-x-0 top-0 rounded-b-2xl bg-white p-5 shadow-lift">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold tracking-tight">
                Land<span className="text-brand-700">Flow</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-700 hover:bg-black/5"
                aria-label="Close menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="mt-4 flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-sand-100"
                >
                  {link.label}
                </Link>
              ))}
              {signedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-sand-100"
                  >
                    Dashboard
                  </Link>
                  {isAdmin ? (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-sand-100"
                    >
                      Admin
                    </Link>
                  ) : isOperator ? (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-sand-100"
                    >
                      Operator
                    </Link>
                  ) : null}
                  <form action="/api/auth/signout" method="post">
                    <button
                      type="submit"
                      onClick={() => setOpen(false)}
                      className="w-full rounded-lg px-3 py-3 text-left text-base font-medium text-ink-900 hover:bg-sand-100"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-sand-100"
                >
                  Sign in
                </Link>
              )}
              <Link
                href="/list-your-land"
                onClick={() => setOpen(false)}
                className="btn btn-primary mt-2 w-full"
              >
                Post land
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
