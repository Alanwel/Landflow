import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import MobileNav from "@/components/MobileNav";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { isOperator } from "@/lib/data";

const LINKS = [
  { href: "/", label: "Browse land" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/list-your-land", label: "Sell your land" },
];

/**
 * The navigation bar.
 *
 * Reading the session is a request read, so it cannot be part of the static
 * shell — it streams in behind a <Suspense> boundary instead. The links are
 * static, so they render instantly either way.
 */
export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/8 bg-white/85 backdrop-blur-md">
      <nav className="page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
              LF
            </span>
            <span className="text-lg font-bold tracking-tight text-ink-900">
              Land<span className="text-brand-700">Flow</span>
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-ink-500 transition-colors hover:text-brand-700"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/*
          The desktop links and the mobile drawer both depend on WHO IS
          SIGNED IN, so they are rendered together by one server component.
          Splitting them let the mobile drawer drift out of sync with the
          desktop nav — it showed "Sign in" to people who were signed in.
        */}
        <Suspense fallback={<div className="h-9 w-24" />}>
          <AuthArea />
        </Suspense>
      </nav>
    </header>
  );
}

async function AuthArea() {
  // Next 16 Cache Components: this component depends on WHO IS SIGNED IN.
  // `connection()` stops the prerender here so the render waits for a real
  // request. Without it, Next tries to prerender the nav (including this
  // Suspense hole) and supabase-ssr reads `Date.now()` while checking the
  // session cookie — an "unstable value" during a prerender.
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [operator, admin] = user
    ? await Promise.all([isOperator(user.id), isAdmin(user.id)])
    : [false, false];

  return (
    <>
      {/* Desktop */}
      <div className="hidden items-center gap-3 md:flex">
        {user ? (
          <>
            <Link href="/dashboard" className="btn btn-ghost">
              Dashboard
            </Link>
            {admin ? (
              <Link href="/admin" className="btn btn-ghost">
                Admin
              </Link>
            ) : operator ? (
              <Link href="/admin" className="btn btn-ghost">
                Operator
              </Link>
            ) : null}
          </>
        ) : (
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
        )}
        <Link href="/list-your-land" className="btn btn-primary">
          Post land
        </Link>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <MobileNav
          links={LINKS}
          signedIn={Boolean(user)}
          isAdmin={admin}
          isOperator={operator}
        />
      </div>
    </>
  );
}
