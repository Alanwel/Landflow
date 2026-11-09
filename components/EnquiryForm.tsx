"use client";

import { useActionState, useState } from "react";

import { sendEnquiryAction } from "@/app/actions";
import { initialFormState } from "@/lib/form-state";
import { Spinner } from "@/components/States";

export default function EnquiryForm({
  listingId,
  sellerName,
}: {
  listingId: string;
  sellerName: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    sendEnquiryAction,
    initialFormState,
  );
  const [showForm, setShowForm] = useState(false);

  const errors = state.fieldErrors;

  if (state.status === "success") {
    return (
      <div className="notice notice-success">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="m8.5 12.2 2.4 2.4 4.6-4.9"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <p className="font-semibold">Enquiry sent</p>
          <p className="mt-0.5 opacity-90">
            {sellerName
              ? `${sellerName} will get your message and reply to your email.`
              : "The seller will get your message and reply to your email."}
          </p>
        </div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="card card-pad">
        <h2 className="text-lg font-semibold text-ink-900">
          Interested in this land?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          Ask the seller a question about the title, the price or a viewing.
          They reply by email, usually within a day.
        </p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="btn btn-primary mt-5 w-full sm:w-auto"
        >
          Contact the seller
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="card card-pad">
      <h2 className="text-lg font-semibold text-ink-900">Contact the seller</h2>
      <p className="mt-1.5 text-sm text-ink-500">
        No account needed. We only pass your details to the seller.
      </p>

      <input type="hidden" name="listingId" value={listingId} />

      {state.status === "error" ? (
        <div className="notice notice-error mt-5">
          <span>{state.message}</span>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label" htmlFor="buyer_name">
            Your name
          </label>
          <input
            id="buyer_name"
            name="buyer_name"
            className={`field ${errors.buyer_name ? "field-error" : ""}`}
            placeholder="Jane Doe"
            maxLength={120}
            autoComplete="name"
            required
          />
          {errors.buyer_name ? (
            <p className="field-error-text">{errors.buyer_name}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="buyer_email">
              Email
            </label>
            <input
              id="buyer_email"
              name="buyer_email"
              type="email"
              className={`field ${errors.buyer_email ? "field-error" : ""}`}
              placeholder="jane@example.com"
              autoComplete="email"
              required
            />
            {errors.buyer_email ? (
              <p className="field-error-text">{errors.buyer_email}</p>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="buyer_phone">
              Phone <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <input
              id="buyer_phone"
              name="buyer_phone"
              type="tel"
              className={`field ${errors.buyer_phone ? "field-error" : ""}`}
              placeholder="+256 7xx xxx xxx"
              autoComplete="tel"
            />
            {errors.buyer_phone ? (
              <p className="field-error-text">{errors.buyer_phone}</p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="message">
            Your message
          </label>
          <textarea
            id="message"
            name="message"
            className={`field min-h-28 resize-y ${errors.message ? "field-error" : ""}`}
            placeholder="I am interested in this land. Is the title in your name, and can I view it this weekend?"
            maxLength={2000}
            required
          />
          {errors.message ? (
            <p className="field-error-text">{errors.message}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? (
            <>
              <Spinner className="h-4 w-4" />
              Sending…
            </>
          ) : (
            "Send enquiry"
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="btn btn-ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
