"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-heading text-sm uppercase tracking-[0.14em] text-text-muted">Error</p>
      <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-[40ch] font-body text-sm leading-relaxed text-text-secondary">
        An unexpected error occurred. Please try again.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={reset}
          className="focus-ring inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-heading text-sm text-text-on-accent"
        >
          Try again
        </button>
        <Link
          href="/"
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface px-5 py-2.5 font-heading text-sm text-text-primary"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}