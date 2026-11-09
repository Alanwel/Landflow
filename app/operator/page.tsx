import { redirect } from "next/navigation";

/**
 * The operator panel now lives at /admin.
 *
 * There used to be two pages: one for operators and one for admins. Two
 * pages means two places to forget a button. One page, role-aware, is
 * easier to reason about and easier to keep correct.
 */
export default function OperatorRedirect() {
  redirect("/admin");
}
