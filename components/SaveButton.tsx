"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/States";

export default function SaveButton({ listingId }: { listingId: string }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ask the database whether this listing is already in the shortlist, so the
  // button shows the truth on first paint instead of guessing.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("saved_listings")
          .select("listing_id")
          .eq("user_id", user.id)
          .eq("listing_id", listingId)
          .maybeSingle();

        if (!cancelled) setSaved(Boolean(data));
      } catch {
        // A failure here is not worth shouting about — the button still works.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listingId]);

  async function toggle() {
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sign in to save land.");
      setBusy(false);
      return;
    }

    if (saved) {
      const { error } = await supabase
        .from("saved_listings")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", listingId);
      if (error) setError(error.message);
      else setSaved(false);
    } else {
      const { error } = await supabase
        .from("saved_listings")
        .insert({ user_id: user.id, listing_id: listingId });
      if (error) setError(error.message);
      else setSaved(true);
    }

    setBusy(false);
  }

  if (loading) {
    return (
      <div className="flex h-[42px] w-40 items-center justify-center">
        <Spinner className="h-4 w-4 text-ink-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={saved ? "btn btn-secondary" : "btn btn-primary"}
      >
        {busy ? (
          <>
            <Spinner className="h-4 w-4" />
          </>
        ) : saved ? (
          "Saved ✓"
        ) : (
          "Save this land"
        )}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
