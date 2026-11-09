import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSavedListings } from "@/lib/data";
import { formatUgxShort } from "@/lib/format";

export const metadata = { title: "Saved land — LandFlow" };

async function SavedContent() {
  // Next 16 Cache Components: this page depends on WHO IS SIGNED IN.
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
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Sign in to see saved land</h1>
        <Link
          href="/login?next=/saved"
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const saved = await getSavedListings(user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Saved land</h1>

      {saved.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-black/20 bg-neutral-50 p-10 text-center">
          <p className="font-semibold">Nothing saved yet.</p>
          <p className="mt-1 text-sm text-neutral-600">
            Tap &ldquo;Save this land&rdquo; on any listing and it will show up
            here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block font-semibold text-emerald-700 hover:underline"
          >
            Browse land
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {saved.map((l) => (
            <li
              key={l.id}
              className="rounded-xl border border-black/10 bg-white p-4"
            >
              <Link
                href={`/listings/${l.id}`}
                className="font-semibold hover:text-emerald-800"
              >
                {l.title}
              </Link>
              <p className="mt-1 text-xs text-neutral-500">
                {l.location} &middot; {l.region}
              </p>
              <p className="mt-2 font-bold text-emerald-800">
                {formatUgxShort(l.price)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function Saved() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-10" />}>
      <SavedContent />
    </Suspense>
  );
}
