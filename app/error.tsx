"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-sm font-bold text-red-600">Error</p>
      <h1 className="mt-3 page-title">That did not work</h1>
      <p className="lede mx-auto">
        Something failed while loading this page. It is most likely a problem
        with the database rather than with anything you did.
      </p>

      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-ink-500">
          Reference: {error.digest}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Back to listings
        </Link>
      </div>
    </main>
  );
}
