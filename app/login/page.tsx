import { Suspense } from "react";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Sign in — LandFlow" };

function LoginContent({
  error,
  next,
}: {
  error?: string;
  next: string;
}) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <>
      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error === "auth_failed"
            ? "Sign-in failed. Please try again."
            : "That sign-in link was invalid. Please try again."}
        </p>
      ) : null}

      <LoginForm next={next} googleClientId={googleClientId} />
    </>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Sign in to LandFlow</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Save listings you like, and post your own land.
      </p>

      <Suspense fallback={<div className="mt-8 h-64" />}>
        <LoginResolver searchParams={searchParams} />
      </Suspense>

      <p className="mt-6 text-center text-xs text-neutral-500">
        Just browsing?{" "}
        <Link href="/" className="font-medium text-emerald-700 hover:underline">
          You do not need an account to view land.
        </Link>
      </p>
    </main>
  );
}

async function LoginResolver({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  return (
    <LoginContent error={sp.error} next={sp.next ?? "/dashboard"} />
  );
}
