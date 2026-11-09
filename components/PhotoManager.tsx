"use client";

import { useActionState, useRef } from "react";

import { deleteListingPhotoAction, uploadListingPhotoAction } from "@/app/actions";
import { initialFormState } from "@/lib/form-state";
import { Spinner } from "@/components/States";
import type { ListingPhoto } from "@/lib/types";

/**
 * The photo manager on "Manage your photos" page.
 *
 * Two separate forms, two separate actions:
 *
 *   - UPLOAD uses <form encType="multipart/form-data">, because a file input
 *     cannot travel in a urlencoded body. The browser sends the file as a
 *     multipart part and `formData.get("photo")` is a File.
 *   - DELETE uses a plain form per photo, with the photo's id in a hidden
 *     field.
 *
 * The upload form also needs `encType` on the FORM element, not just on the
 * button — that is the bit people forget.
 */
export default function PhotoManager({
  listingId,
  photos,
}: {
  listingId: string;
  photos: ListingPhoto[];
}) {
  const [uploadState, uploadAction, uploading] = useActionState(
    uploadListingPhotoAction,
    initialFormState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteListingPhotoAction,
    initialFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-6">
      {/* Upload ------------------------------------------------------- */}
      <form
        ref={formRef}
        action={uploadAction}
        encType="multipart/form-data"
        className="card card-pad"
      >
        <input type="hidden" name="listingId" value={listingId} />

        <h2 className="text-base font-bold tracking-tight text-ink-900">
          Add a photo
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          The first photo is the one buyers see in the marketplace. JPG, PNG or
          WebP, up to 5MB.
        </p>

        {uploadState.status === "error" ? (
          <div className="notice notice-error mt-4">
            <span>{uploadState.message}</span>
          </div>
        ) : null}
        {uploadState.status === "success" ? (
          <div className="notice notice-success mt-4">
            <span>{uploadState.message}</span>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            required
            className="field max-w-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
          />
          <button type="submit" disabled={uploading} className="btn btn-primary">
            {uploading ? (
              <>
                <Spinner className="h-4 w-4" />
                Uploading…
              </>
            ) : (
              "Upload photo"
            )}
          </button>
        </div>
      </form>

      {/* The photos --------------------------------------------------- */}
      <div className="card card-pad">
        <h2 className="text-base font-bold tracking-tight text-ink-900">
          Photos on this listing
        </h2>

        {deleteState.status === "error" ? (
          <div className="notice notice-error mt-4">
            <span>{deleteState.message}</span>
          </div>
        ) : null}

        {photos.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">
            No photos yet. Land with pictures sells faster — add at least one.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {photos.map((photo, i) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-xl border border-black/10 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={`Photo ${i + 1}`}
                  className="aspect-16/10 w-full object-cover"
                />
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-xs font-medium text-ink-500">
                    {i === 0 ? "Cover photo" : `Photo ${i + 1}`}
                  </span>
                  <form action={deleteAction}>
                    <input type="hidden" name="photoId" value={photo.id} />
                    <button
                      type="submit"
                      disabled={deleting}
                      className="btn btn-danger btn-sm"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
