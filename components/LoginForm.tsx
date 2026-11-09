"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/States";

export default function LoginForm({
  next,
  googleClientId,
}: {
  next: string;
  googleClientId?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    const supabase = createClient();

    if (mode === "signup") {
      // A banned email must not be able to walk back in and create a fresh
      // account. The check is a SECURITY DEFINER function, so it works
      // while nobody is signed in — and it returns only a boolean, so it
      // cannot be used to find out who is banned.
      const { data: blocked, error: checkError } = await supabase.rpc(
        "email_is_banned",
        { p_email: email },
      );

      // A failure here must NOT block the sign-up: the same check runs on
      // the server inside create_account(), and that is the one that counts.
      // Blocking on a flaky client-side call would lock people out of a
      // working sign-up form.

      if (blocked) {
        setError(
          "This email address cannot be used to create an account. If you think that is a mistake, contact the site owner.",
        );
        setBusy(false);
        return;
      }

      // Creating the account goes through a DATABASE FUNCTION, not
      // supabase.auth.signUp().
      //
      // signUp() sends a confirmation email, and Supabase's built-in mailer
      // allows only a couple of messages an hour and silently drops the
      // rest — so the link never arrived and nobody could finish signing
      // up. create_account() creates the account with the address already
      // confirmed, so there is no email to wait for.
      //
      // It also does the checks the browser used to do, on the server: a
      // banned address is refused, and an address that already has an
      // account is refused. Those checks were client-side, so anyone could
      // have skipped them by calling the API directly.
      const { data: userId, error: createError } = await supabase.rpc(
        "create_account",
        {
          p_email: email.trim(),
          p_password: password,
          p_full_name: fullName.trim() || null,
        },
      );

      if (createError) {
        setError(createError.message);
        setBusy(false);
        return;
      }

      if (!userId) {
        setError("We could not create that account. Please try again.");
        setBusy(false);
        return;
      }

      // The account exists and is confirmed — sign in straight away.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(
          "Your account was created, but we could not sign you in. Please use the Sign in tab.",
        );
        setBusy(false);
        return;
      }

      window.location.href = next;
      return;
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        // A SUSPENDED ACCOUNT.
        //
        // The database already refuses every request from this session —
        // the ban is read inside the row policies, so their token grants
        // them nothing. This block is not the security; it is the
        // explanation. Without it they would sign in and land on a page
        // full of silent failures with no idea why.
        const {
          data: { user: signedIn },
        } = await supabase.auth.getUser();

        if (signedIn) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_banned, banned_reason")
            .eq("id", signedIn.id)
            .maybeSingle();

          if (profile?.is_banned) {
            await supabase.auth.signOut();
            setError(
              profile.banned_reason
                ? `This account has been suspended: ${profile.banned_reason}`
                : "This account has been suspended. Contact the site owner if you think that is a mistake.",
            );
            setBusy(false);
            return;
          }
        }

        window.location.href = next;
      }
    }

    setBusy(false);
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <form onSubmit={handleEmail} className="mt-8 flex flex-col gap-5">
      {error ? (
        <div className="notice notice-error">
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="notice notice-success">
          <span>{message}</span>
        </div>
      ) : null}

      {mode === "signup" ? (
        <label className="flex flex-col">
          <span className="field-label">Your name</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            className="field"
            placeholder="e.g. Allan Mukasa"
          />
          <span className="field-hint">
            Sellers see this when they read your enquiry.
          </span>
        </label>
      ) : null}

      <label className="flex flex-col">
        <span className="field-label">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="field"
          placeholder="you@example.com"
        />
      </label>

      <label className="flex flex-col">
        <span className="field-label">Password</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="field"
        />
        {mode === "signup" ? (
          <span className="field-hint">At least 8 characters.</span>
        ) : null}
      </label>

      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? (
          <>
            <Spinner className="h-4 w-4" />
            Please wait…
          </>
        ) : mode === "signup" ? (
          "Create account"
        ) : (
          "Sign in"
        )}
      </button>

      {googleClientId ? (
        <>
          <div className="flex items-center gap-3 text-xs text-ink-500">
            <span className="h-px flex-1 bg-black/10" />
            or
            <span className="h-px flex-1 bg-black/10" />
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            className="btn btn-secondary w-full"
          >
            Continue with Google
          </button>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMessage(null);
          setError(null);
        }}
        className="text-sm font-medium text-brand-700 hover:underline"
      >
        {mode === "signin"
          ? "No account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
