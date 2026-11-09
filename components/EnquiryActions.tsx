"use client";

import { useActionState } from "react";

import {
  deleteEnquiryAction,
  setEnquiryStatusAction,
} from "@/app/actions";
import { initialFormState } from "@/lib/form-state";
import { Spinner } from "@/components/States";

const STATUSES = ["new", "read", "replied", "closed"] as const;

const LABELS: Record<string, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
  closed: "Closed",
};

export default function EnquiryActions({
  enquiryId,
  currentStatus,
  mode,
}: {
  enquiryId: string;
  currentStatus: string;
  /** "seller" can move it along; "buyer" can only withdraw it. */
  mode: "seller" | "buyer";
}) {
  const [state, formAction, pending] = useActionState(
    setEnquiryStatusAction,
    initialFormState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEnquiryAction,
    initialFormState,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === "seller" ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="enquiryId" value={enquiryId} />
          <label className="sr-only" htmlFor={`enq-status-${enquiryId}`}>
            Enquiry status
          </label>
          <select
            id={`enq-status-${enquiryId}`}
            name="status"
            defaultValue={currentStatus}
            className="field !w-auto !py-1.5 !text-xs"
            disabled={pending}
            onChange={(e) => {
              const form = e.currentTarget.form;
              if (form) form.requestSubmit();
            }}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {LABELS[status]}
              </option>
            ))}
          </select>
          {pending ? <Spinner className="h-3.5 w-3.5 text-ink-500" /> : null}
        </form>
      ) : (
        <span className="badge badge-neutral">{LABELS[currentStatus]}</span>
      )}

      <form action={deleteAction}>
        <input type="hidden" name="enquiryId" value={enquiryId} />
        <button
          type="submit"
          disabled={deletePending}
          className="btn btn-sm btn-ghost text-red-700 hover:bg-red-50"
          onClick={(e) => {
            if (!confirm("Remove this enquiry?")) e.preventDefault();
          }}
        >
          {deletePending ? "Removing…" : "Remove"}
        </button>
      </form>

      {state.status === "error" ? (
        <p className="text-xs text-red-700">{state.message}</p>
      ) : null}
      {deleteState.status === "error" ? (
        <p className="text-xs text-red-700">{deleteState.message}</p>
      ) : null}
    </div>
  );
}
