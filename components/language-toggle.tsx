"use client";

import { useState } from "react";
import { setLanguage } from "@/features/actions";
import type { Lang } from "@/lib/i18n";

/** Client switcher for the per-user UI language (all RBAC surfaces). */
export function LanguageToggle({ current }: { current: Lang }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function choose(lang: Lang) {
    setBusy(true);
    setDone(false);
    const res = await setLanguage({ lang });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      // Re-render server components (nav, eyebrow, settings) in the new language.
      window.location.reload();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Interface language">
        <button
          type="button"
          role="radio"
          aria-checked={current === "id"}
          disabled={busy}
          onClick={() => choose("id")}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
            current === "id"
              ? "border-blue-700 bg-blue-700 text-white"
              : "hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Bahasa Indonesia
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={current === "en"}
          disabled={busy}
          onClick={() => choose("en")}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
            current === "en"
              ? "border-blue-700 bg-blue-700 text-white"
              : "hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          English
        </button>
      </div>
      {done && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          Language preference saved.
        </p>
      )}
    </div>
  );
}
