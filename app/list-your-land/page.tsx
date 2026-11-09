import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";

import ListingForm from "@/components/ListingForm";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Post your land — LandFlow" };

export default function ListYourLandPage() {
  return (
    <main className="page py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">For landowners</p>
        <h1 className="mt-3 page-title">Post your land</h1>
        <p className="lede">
          One form, no fee, no agent. Buyers find your listing, send you an
          enquiry, and you reply directly.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-2xl">
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <ListYourLand />
        </Suspense>
      </div>
    </main>
  );
}

async function ListYourLand() {
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
      <div className="card card-pad text-center">
        <h2 className="text-lg font-semibold text-ink-900">
          Sign in to post your land
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
          We need an account so buyers know who they are talking to, and so you
          can come back to answer their questions.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login?next=/list-your-land" className="btn btn-primary">
            Sign in
          </Link>
          <Link href="/" className="btn btn-secondary">
            Browse land first
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="notice notice-info mb-6">
        <span>
          Posting as <strong className="font-semibold">{user.email}</strong>.
          Buyers will see your name and be able to reply to you directly.
        </span>
      </div>
      <ListingForm />
    </>
  );
}
