"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COMMON, LANG_COOKIE, isLang, type Lang } from "@/lib/i18n";

/** Error boundary dasar per segmen (App Router). Tidak menampilkan stack ke user. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang] = useState<Lang>(() => {
    if (typeof document === "undefined") return "id";
    const v = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${LANG_COOKIE}=`))
      ?.split("=")[1];
    return isLang(v) ? v : "id";
  });
  useEffect(() => {
    // Log server-side via reporting; jangan kirim PII/token ke client log.
    console.error("Route error:", error.digest ?? error.message);
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">{COMMON.somethingWrong[lang]}</h1>
      <p className="mt-2 text-slate-600">
        {COMMON.errorBody[lang]}
        {error.digest ? ` (ref: ${error.digest})` : ""}.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800"
        >
          {COMMON.reload[lang]}
        </button>
        <Link href="/" className="rounded-lg border px-5 py-2 font-semibold hover:bg-slate-50">
          {COMMON.home[lang]}
        </Link>
      </div>
    </main>
  );
}
