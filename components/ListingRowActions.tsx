"use client";

import { useActionState } from "react";

import {
  deleteListingAction,
  setListingStatusAction,
} from "@/app/actions";
import { initialFormState } from "@/lib/form-state";
import { Spinner } from "@/components/States";

const STATUSES = ["active", "sold", "rented"] as const;

export default function ListingRowActions({
  listingId,
  currentStatus,
}: {
  listingId: string;
  currentStatus: string;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    setListingStatusAction,
    initialFormState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteListingAction,
    initialFormState,
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={statusAction} className="flex items-center gap-2">
        <input type="hidden" name="listingId" value={listingId} />
        <label className="sr-only" htmlFor={`status-${listingId}`}>
          Listing status
        </label>
        <select
          id={`status-${listingId}`}
          name="status"
          defaultValue={currentStatus}
          className="field !w-auto !py-1.5 !text-xs"
          disabled={statusPending}
          onChange={(e) => {
            const form = e.currentTarget.form;
            if (form) form.requestSubmit();
          }}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {statusPending ? <Spinner className="h-3.5 w-3.5 text-ink-500" /> : null}
      </form>

      <form action={deleteAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <button
          type="submit"
          disabled={deletePending}
          className="btn btn-sm btn-danger"
          onClick={(e) => {
            if (!confirm("Remove this listing for good?")) e.preventDefault();
          }}
        >
          {deletePending ? "Removing…" : "Remove"}
        </button>
      </form>

      {statusState.status === "error" ? (
        <p className="text-xs text-red-700">{statusState.message}</p>
      ) : null}
      {deleteState.status === "error" ? (
        <p className="text-xs text-red-700">{deleteState.message}</p>
      ) : null}
    </div>
  );
}
