"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { LAND_TYPES, REGIONS } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
};

export default function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();

  // Local copy of the search text so typing stays smooth, and the URL is
  // only updated once the user pauses. The old version pushed a route change
  // on every single keystroke — one history entry per letter.
  const [query, setQuery] = useState(params.get("q") ?? "");
  const firstRender = useRef(true);

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const current = params.get("q") ?? "";
      if (query === current) return;
      update("q", query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, params, update]);

  const hasFilters =
    params.get("q") ||
    params.get("region") ||
    params.get("type") ||
    params.get("max");

  return (
    <div className="card card-pad">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col">
          <span className="field-label">Search</span>
          <input
            type="search"
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, description, location…"
          />
        </label>

        <label className="flex flex-col">
          <span className="field-label">Region</span>
          <select
            className="field"
            value={params.get("region") ?? ""}
            onChange={(e) => update("region", e.target.value)}
          >
            <option value="">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="field-label">Land type</span>
          <select
            className="field"
            value={params.get("type") ?? ""}
            onChange={(e) => update("type", e.target.value)}
          >
            <option value="">All types</option>
            {LAND_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="field-label">Max price (UGX)</span>
          <input
            type="number"
            min={0}
            className="field"
            defaultValue={params.get("max") ?? ""}
            placeholder="e.g. 100000000"
            onBlur={(e) => update("max", e.target.value)}
          />
        </label>
      </div>

      {hasFilters ? (
        <div className="mt-4 flex items-center justify-between border-t border-black/8 pt-4">
          <p className="text-xs text-ink-500">Filters are applied as you type.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.push("/", { scroll: false });
            }}
            className="btn btn-sm btn-ghost"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
