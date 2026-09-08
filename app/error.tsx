"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Error boundary dasar per segmen (App Router). Tidak menampilkan stack ke user. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log server-side via reporting; jangan kirim PII/token ke client log.
    console.error("Route error:", error.digest ?? error.message);
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-slate-600">
        Sorry, this page could not be loaded. Try reloading{error.digest ? ` (ref: ${error.digest})` : ""}.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800"
        >
          Reload
        </button>
        <Link href="/" className="rounded-lg border px-5 py-2 font-semibold hover:bg-slate-50">
          Home
        </Link>
      </div>
    </main>
  );
}
