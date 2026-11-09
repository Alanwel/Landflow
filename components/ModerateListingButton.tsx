"use client";

import { useActionState } from "react";

import { setListingModerationAction } from "@/app/actions";
import { initialFormState } from "@/lib/form-state";
import { Spinner } from "@/components/States";

/**
 * The hide / unhide button in the operator panel.
 *
 * "Hiding" a listing does not delete it. It sets the status to 'hidden',
 * which the public read policy filters out — so the listing disappears from
 * the marketplace but the owner still has it, and the operator can put it
 * back. Deleting somebody's land because it broke a rule is a last resort.
 */
export default function ModerateListingButton({
  listingId,
  hidden,
}: {
  listingId: string;
  hidden: boolean;
}) {
  const [state, action, pending] = useActionState(
    setListingModerationAction,
    initialFormState,
  );

  return (
    <form action={action} className="inline">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="hidden" value={hidden ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className={`btn btn-sm ${hidden ? "btn-secondary" : "btn-danger"}`}
        title={
          hidden
            ? "Put this listing back on the marketplace"
            : "Take this listing off the marketplace"
        }
      >
        {pending ? (
          <Spinner className="h-3 w-3" />
        ) : hidden ? (
          "Restore"
        ) : (
          "Hide"
        )}
      </button>
      {state.status === "error" ? (
        <span className="ml-2 text-xs text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}
