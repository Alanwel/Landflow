"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  adminDeleteEnquiryAction,
  adminSetEnquiryStatusAction,
} from "@/app/actions";
import { initialFormState } from "@/lib/form-state";
import { Spinner } from "@/components/States";
import type { Enquiry } from "@/lib/data";

const STATUSES = ["new", "read", "replied", "closed"] as const;

/** One enquiry in the admin's enquiries table. */
export default function AdminEnquiryRow({ enquiry }: { enquiry: Enquiry }) {
  const [statusState, statusAction, saving] = useActionState(
    adminSetEnquiryStatusAction,
    initialFormState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    adminDeleteEnquiryAction,
    initialFormState,
  );

  const sent = new Date(enquiry.createdAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">
            {enquiry.buyerName}
            <span className="ml-2 text-sm font-normal text-ink-500">
              {enquiry.buyerEmail}
            </span>
            {enquiry.buyerPhone ? (
              <span className="ml-2 text-sm font-normal text-ink-500">
                {enquiry.buyerPhone}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            About{" "}
            <Link
              href={`/listings/${enquiry.listingId}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {enquiry.listing?.title ?? "a listing"}
            </Link>{" "}
            · {sent}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <form action={statusAction} className="flex items-center gap-2">
            <input type="hidden" name="enquiryId" value={enquiry.id} />
            <label className="sr-only" htmlFor={`st-${enquiry.id}`}>
              Enquiry status
            </label>
            <select
              id={`st-${enquiry.id}`}
              name="status"
              defaultValue={enquiry.status}
              className="field !w-auto !py-1.5 !text-xs"
              disabled={saving}
              onChange={(e) => {
                const form = e.currentTarget.form;
                if (form) form.requestSubmit();
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {saving ? <Spinner className="h-3.5 w-3.5 text-ink-500" /> : null}
          </form>

          <form action={deleteAction}>
            <input type="hidden" name="enquiryId" value={enquiry.id} />
            <button
              type="submit"
              disabled={deleting}
              className="btn btn-sm btn-danger"
              onClick={(e) => {
                if (!confirm("Delete this enquiry?")) e.preventDefault();
              }}
            >
              {deleting ? "…" : "Delete"}
            </button>
          </form>
        </div>
      </div>

      <p className="mt-3 border-l-2 border-black/10 pl-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-700">
        {enquiry.message}
      </p>

      {statusState.status === "error" ? (
        <p className="mt-2 text-xs text-red-700">{statusState.message}</p>
      ) : null}
      {deleteState.status === "error" ? (
        <p className="mt-2 text-xs text-red-700">{deleteState.message}</p>
      ) : null}
    </li>
  );
}
