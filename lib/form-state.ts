/**
 * The shape every form action returns, and the state a form starts with.
 *
 * WHY THIS IS NOT IN `app/actions.ts`
 *   That file has the "use server" directive, and Next only allows ASYNC
 *   FUNCTIONS to be exported from a "use server" module. Exporting a plain
 *   object from it means the client receives `undefined` for that export —
 *   and `useActionState(action, undefined)` blows up with
 *   "Cannot read properties of undefined (reading 'fieldErrors')".
 *
 *   So the type and the initial value live here, in an ordinary module that
 *   both the server actions and the client components can import.
 */

export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
};

export const initialFormState: FormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
