import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PhotoManager from "@/components/PhotoManager";
import { createClient } from "@/lib/supabase/server";
import { getListing, getListingPhotos } from "@/lib/data";

export const metadata = { title: "Manage your photos — LandFlow" };

async function PhotosContent({ params }: { params: Promise<{ id: string }> }) {
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/listings/${id}/photos`)}`);

  const listing = await getListing(id);
  if (!listing) notFound();

  // The page is for the OWNER. The database would refuse the writes anyway
  // — this only saves the owner a confusing error message.
  if (listing.seller_id !== user.id) notFound();

  const photos = await getListingPhotos(id);

  return (
    <main className="page py-10 sm:py-14">
      <Link
        href={`/listings/${id}`}
        className="text-sm font-medium text-ink-500 transition-colors hover:text-brand-700"
      >
        &larr; Back to your listing
      </Link>

      <p className="eyebrow mt-6">Photos</p>
      <h1 className="mt-3 page-title">Show people what they are buying</h1>
      <p className="lede">
        You are managing the photos for{" "}
        <span className="font-semibold text-ink-900">{listing.title}</span>.
      </p>

      <div className="mt-8 max-w-3xl">
        <PhotoManager listingId={id} photos={photos} />
      </div>
    </main>
  );
}

export default function ManagePhotos({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="page py-16" />}>
      <PhotosContent params={params} />
    </Suspense>
  );
}
