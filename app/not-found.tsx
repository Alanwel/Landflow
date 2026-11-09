import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-sm font-bold text-brand-600">404</p>
      <h1 className="mt-3 page-title">This page does not exist</h1>
      <p className="lede mx-auto">
        The listing may have been sold, removed by its owner, or the link may be
        wrong.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Browse land
        </Link>
        <Link href="/how-it-works" className="btn btn-secondary">
          How it works
        </Link>
      </div>
    </main>
  );
}
