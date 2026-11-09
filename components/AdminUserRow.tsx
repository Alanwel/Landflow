"use client";

import { useActionState } from "react";

import {
  adminDeleteUserAction,
  adminSetBanAction,
  adminSetRoleAction,
} from "@/app/actions";
import { initialFormState } from "@/lib/form-state";
import { Spinner } from "@/components/States";
import type { AdminUser } from "@/lib/types";

/**
 * One person in the admin's people table.
 *
 * Everything here goes through a SECURITY DEFINER function, not a plain
 * table update. The reason is in supabase/schema.sql section 1c: the role
 * and ban columns are NOT in the column-level grant for `authenticated`, so
 * there is no way to reach them except through a function that checks
 * `is_admin()` itself.
 */
export default function AdminUserRow({
  user,
  isSelf,
}: {
  user: AdminUser;
  isSelf: boolean;
}) {
  const [roleState, roleAction, savingRole] = useActionState(
    adminSetRoleAction,
    initialFormState,
  );
  const [banState, banAction, savingBan] = useActionState(
    adminSetBanAction,
    initialFormState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    adminDeleteUserAction,
    initialFormState,
  );

  const joined = new Date(user.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <li className="card card-pad">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink-900">
              {user.fullName ?? "No name"}
            </p>
            {user.isAdmin ? (
              <span className="badge badge-brand">Admin</span>
            ) : null}
            {user.isOperator ? (
              <span className="badge badge-neutral">Operator</span>
            ) : null}
            {user.isBanned ? (
              <span className="badge badge-neutral">Suspended</span>
            ) : null}
            {isSelf ? (
              <span className="badge badge-neutral">That&apos;s you</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {user.email ?? "No email on file"} · joined {joined} ·{" "}
            {user.listingCount} listing{user.listingCount === 1 ? "" : "s"} ·{" "}
            {user.enquiryCount} sent
          </p>
          {user.isBanned && user.bannedReason ? (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">
              Reason: {user.bannedReason}
            </p>
          ) : null}
        </div>

        <details className="w-full sm:w-auto">
          <summary className="btn btn-sm btn-secondary cursor-pointer">
            Manage
          </summary>

          <div className="mt-4 grid gap-4 rounded-xl border border-black/10 bg-sand-50 p-4">
            {/* Role ------------------------------------------------- */}
            <form action={roleAction} className="grid gap-3">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="isOperator" value="false" />
              <input type="hidden" name="isAdmin" value="false" />

              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Role
              </p>

              <select
                name="role"
                defaultValue={
                  user.isAdmin ? "admin" : user.isOperator ? "operator" : "user"
                }
                className="field"
                onChange={(e) => {
                  const form = e.currentTarget.form;
                  const value = e.target.value;
                  const op = form?.elements.namedItem(
                    "isOperator",
                  ) as HTMLInputElement | null;
                  const ad = form?.elements.namedItem(
                    "isAdmin",
                  ) as HTMLInputElement | null;
                  if (op) op.value = value === "operator" || value === "admin" ? "true" : "false";
                  if (ad) ad.value = value === "admin" ? "true" : "false";
                }}
              >
                <option value="user">User — no extra powers</option>
                <option value="operator">
                  Operator — moderates listings, sees every enquiry
                </option>
                <option value="admin">Admin — full control of the site</option>
              </select>

              {roleState.status === "error" ? (
                <p className="text-xs text-red-700">{roleState.message}</p>
              ) : null}
              {roleState.status === "success" ? (
                <p className="text-xs text-brand-700">{roleState.message}</p>
              ) : null}

              <button type="submit" disabled={savingRole} className="btn btn-sm btn-primary">
                {savingRole ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" />
                    Saving…
                  </>
                ) : (
                  "Save role"
                )}
              </button>
            </form>

            {/* Ban -------------------------------------------------- */}
            <form action={banAction} className="grid gap-3 border-t border-black/8 pt-4">
              <input type="hidden" name="userId" value={user.id} />
              <input
                type="hidden"
                name="banned"
                value={user.isBanned ? "false" : "true"}
              />

              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                {user.isBanned ? "Restore this account" : "Suspend this account"}
              </p>

              {!user.isBanned ? (
                <>
                  <input
                    type="text"
                    name="reason"
                    placeholder="Reason (shown to the user)"
                    className="field"
                    maxLength={200}
                  />
                  <label className="flex items-center gap-2 text-sm text-ink-700">
                    <input type="checkbox" name="blockEmail" value="true" />
                    Also block this email from signing up again
                  </label>
                  <p className="text-xs text-ink-500">
                    A suspension takes effect immediately: the database reads
                    the flag inside the policies, so their existing session
                    stops working on the next request.
                  </p>
                </>
              ) : null}

              {banState.status === "error" ? (
                <p className="text-xs text-red-700">{banState.message}</p>
              ) : null}
              {banState.status === "success" ? (
                <p className="text-xs text-brand-700">{banState.message}</p>
              ) : null}

              <button
                type="submit"
                disabled={savingBan}
                className={`btn btn-sm ${user.isBanned ? "btn-primary" : "btn-danger"}`}
              >
                {savingBan ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" />
                    Working…
                  </>
                ) : user.isBanned ? (
                  "Restore account"
                ) : (
                  "Suspend account"
                )}
              </button>
            </form>

            {/* Delete ---------------------------------------------- */}
            <form
              action={deleteAction}
              className="grid gap-3 border-t border-black/8 pt-4"
            >
              <input type="hidden" name="userId" value={user.id} />
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Delete
              </p>
              <p className="text-xs text-ink-500">
                Removes the profile. Their listings, photos and enquiries go
                with it, and their email is blocked from signing up again.
              </p>
              {deleteState.status === "error" ? (
                <p className="text-xs text-red-700">{deleteState.message}</p>
              ) : null}
              <button
                type="submit"
                disabled={deleting || isSelf}
                className="btn btn-sm btn-danger"
                onClick={(e) => {
                  if (
                    !confirm(
                      "Delete this account? Their listings and enquiries go too.",
                    )
                  )
                    e.preventDefault();
                }}
              >
                {deleting ? "Deleting…" : "Delete account"}
              </button>
            </form>
          </div>
        </details>
      </div>
    </li>
  );
}
