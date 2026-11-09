"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  adminDeleteListingAction,
  adminUpdateListingAction,
} from "@/app/actions";
import { initialFormState } from "@/lib/form-state";
import { LAND_TYPES, REGIONS } from "@/lib/types";
import { Spinner } from "@/components/States";
import type { Listing } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
};

const STATUSES = ["active", "sold", "rented", "hidden"] as const;

/**
 * One row of the admin's listings table.
 *
 * The edit form is inside a <details> so that twenty listings do not turn
 * into twenty open forms. Each row has its own action state, so editing one
 * listing does not reset the others.
 */
export default function AdminListingRow({
  listing,
  sellerName,
}: {
  listing: Listing;
  sellerName: string;
}) {
  const [editState, editAction, editing] = useActionState(
    adminUpdateListingAction,
    initialFormState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    adminDeleteListingAction,
    initialFormState,
  );

  return (
    <li className="card card-pad">
      <div className="flex flex-wrap items-start gap-4">
        {listing.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.coverUrl}
            alt=""
            className="h-16 w-24 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-sand-100 text-2xl">
            🏞️
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/listings/${listing.id}`}
              className="font-semibold text-ink-900 hover:text-brand-700"
            >
              {listing.title}
            </Link>
            <span
              className={`badge ${listing.status === "active" ? "badge-brand" : "badge-neutral"}`}
            >
              {listing.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {listing.location}, {listing.region} ·{" "}
            {TYPE_LABELS[listing.land_type] ?? listing.land_type} ·{" "}
            <span className="font-semibold text-brand-700">
              {listing.price.toLocaleString()} UGX
            </span>{" "}
            · {sellerName}
          </p>
        </div>

        <details className="w-full sm:w-auto">
          <summary className="btn btn-sm btn-secondary cursor-pointer">
            Edit
          </summary>
          <form
            action={editAction}
            className="mt-4 grid gap-4 rounded-xl border border-black/10 bg-sand-50 p-4 sm:grid-cols-2"
          >
            <input type="hidden" name="listingId" value={listing.id} />

            {editState.status === "error" ? (
              <div className="notice notice-error sm:col-span-2">
                <span>{editState.message}</span>
              </div>
            ) : null}
            {editState.status === "success" ? (
              <div className="notice notice-success sm:col-span-2">
                <span>{editState.message}</span>
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <label className="field-label" htmlFor={`t-${listing.id}`}>
                Title
              </label>
              <input
                id={`t-${listing.id}`}
                name="title"
                defaultValue={listing.title}
                className="field"
                maxLength={120}
              />
            </div>

            <div>
              <label className="field-label" htmlFor={`p-${listing.id}`}>
                Price (UGX)
              </label>
              <input
                id={`p-${listing.id}`}
                name="price"
                type="number"
                defaultValue={listing.price}
                className="field"
                min={1}
              />
            </div>

            <div>
              <label className="field-label" htmlFor={`s-${listing.id}`}>
                Status
              </label>
              <select
                id={`s-${listing.id}`}
                name="status"
                defaultValue={listing.status}
                className="field"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor={`l-${listing.id}`}>
                Location
              </label>
              <input
                id={`l-${listing.id}`}
                name="location"
                defaultValue={listing.location}
                className="field"
                maxLength={120}
              />
            </div>

            <div>
              <label className="field-label" htmlFor={`r-${listing.id}`}>
                Region
              </label>
              <select
                id={`r-${listing.id}`}
                name="region"
                defaultValue={listing.region}
                className="field"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor={`ty-${listing.id}`}>
                Type
              </label>
              <select
                id={`ty-${listing.id}`}
                name="land_type"
                defaultValue={listing.land_type}
                className="field"
              >
                {LAND_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="field-label" htmlFor={`d-${listing.id}`}>
                Description
              </label>
              <textarea
                id={`d-${listing.id}`}
                name="description"
                defaultValue={listing.description}
                className="field min-h-28 resize-y"
                maxLength={4000}
              />
            </div>

            <div className="sm:col-span-2">
              <button type="submit" disabled={editing} className="btn btn-primary btn-sm">
                {editing ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </form>
        </details>

        <form action={deleteAction}>
          <input type="hidden" name="listingId" value={listing.id} />
          <button
            type="submit"
            disabled={deleting}
            className="btn btn-sm btn-danger"
            onClick={(e) => {
              if (
                !confirm(
                  "Delete this listing for good? Its photos and enquiries go too.",
                )
              )
                e.preventDefault();
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>

      {deleteState.status === "error" ? (
        <p className="mt-3 text-xs text-red-700">{deleteState.message}</p>
      ) : null}
    </li>
  );
}
