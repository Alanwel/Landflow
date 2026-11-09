"use client";

import { useState } from "react";

import type { ListingPhoto } from "@/lib/types";

/**
 * The picture gallery on a listing page.
 *
 * A client component because the selected photo is state. Everything else
 * about the page is a server component — this is the only part that needs
 * to know "which photo is the user looking at".
 */
export default function ListingGallery({
  photos,
  title,
}: {
  photos: ListingPhoto[];
  title: string;
}) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-16/10 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/15 bg-sand-100 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-card">
          🏞️
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-900">No photos yet</p>
          <p className="mt-1 text-sm text-ink-500">
            The owner has not added pictures of this land.
          </p>
        </div>
      </div>
    );
  }

  const active = photos[Math.min(index, photos.length - 1)];

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-sand-100 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.url}
          alt={`${title} — photo ${index + 1} of ${photos.length}`}
          className="aspect-16/10 w-full object-cover"
        />

        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
              aria-label="Previous photo"
              className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-lift transition hover:bg-white"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % photos.length)}
              aria-label="Next photo"
              className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-lift transition hover:bg-white"
            >
              →
            </button>
          </>
        ) : null}

        <span className="absolute right-3 bottom-3 rounded-full bg-ink-900/75 px-2.5 py-1 text-xs font-medium text-white">
          {index + 1} / {photos.length}
        </span>
      </div>

      {photos.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={`shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === index
                  ? "border-brand-600"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="h-16 w-24 object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
