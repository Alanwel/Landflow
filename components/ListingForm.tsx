"use client";

import { useActionState } from "react";

import { createListingAction } from "@/app/actions";
import { initialFormState } from "@/lib/form-state";
import { LAND_TYPES, REGIONS } from "@/lib/types";
import { Spinner } from "@/components/States";

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
};

export default function ListingForm() {
  const [state, formAction, pending] = useActionState(
    createListingAction,
    initialFormState,
  );

  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="card card-pad">
      {state.status === "error" ? (
        <div className="notice notice-error mb-6">
          <span>{state.message}</span>
        </div>
      ) : null}

      <div className="space-y-5">
        <div>
          <label className="field-label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            className={`field ${errors.title ? "field-error" : ""}`}
            placeholder="2 acres of prime land in Wakiso, title in your name"
            maxLength={120}
            required
          />
          {errors.title ? (
            <p className="field-error-text">{errors.title}</p>
          ) : (
            <p className="field-hint">
              A good title says what, where and how big. Buyers search on it.
            </p>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            className={`field min-h-36 resize-y ${errors.description ? "field-error" : ""}`}
            placeholder="Size in acres or hectares, road access, water and power, title documents available, neighbours…"
            maxLength={4000}
            required
          />
          {errors.description ? (
            <p className="field-error-text">{errors.description}</p>
          ) : (
            <p className="field-hint">
              Be honest about what is there. Land sells on trust.
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="price">
              Asking price (UGX)
            </label>
            <input
              id="price"
              name="price"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className={`field ${errors.price ? "field-error" : ""}`}
              placeholder="45000000"
              required
            />
            {errors.price ? (
              <p className="field-error-text">{errors.price}</p>
            ) : (
              <p className="field-hint">
                Whole shillings. Buyers can filter by price.
              </p>
            )}
          </div>

          <div>
            <label className="field-label" htmlFor="land_type">
              Type of land
            </label>
            <select
              id="land_type"
              name="land_type"
              className={`field ${errors.land_type ? "field-error" : ""}`}
              defaultValue="residential"
              required
            >
              {LAND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type] ?? type}
                </option>
              ))}
            </select>
            {errors.land_type ? (
              <p className="field-error-text">{errors.land_type}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="location">
              Location / area
            </label>
            <input
              id="location"
              name="location"
              className={`field ${errors.location ? "field-error" : ""}`}
              placeholder="Kira, off Jinja Road"
              maxLength={120}
              required
            />
            {errors.location ? (
              <p className="field-error-text">{errors.location}</p>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="region">
              Region
            </label>
            <select
              id="region"
              name="region"
              className={`field ${errors.region ? "field-error" : ""}`}
              defaultValue="Kampala"
              required
            >
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            {errors.region ? (
              <p className="field-error-text">{errors.region}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-black/8 pt-6">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? (
            <>
              <Spinner className="h-4 w-4" />
              Posting…
            </>
          ) : (
            "Post this land"
          )}
        </button>
        <p className="text-xs text-ink-500">
          Your name and email appear on the listing so buyers can reach you.
        </p>
      </div>
    </form>
  );
}
