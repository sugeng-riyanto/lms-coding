"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "lms-font-scale";
const STEPS = [90, 100, 110, 125] as const;

function readSavedScale(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if ((STEPS as readonly number[]).includes(saved)) return saved;
  } catch {
    /* localStorage tidak tersedia */
  }
  return 100;
}

/** Kontrol ukuran teks (font scaling): A− / A+ / reset, tersimpan lokal,
 *  diterapkan pada `html` sehingga seluruh layout rem ikut membesar. */
export function FontScaleControl({ lang = "id" }: { lang?: "id" | "en" }) {
  const [scale, setScale] = useState<number>(readSavedScale);
  const en = lang === "en";

  useEffect(() => {
    document.documentElement.style.fontSize = `${scale}%`;
    try {
      localStorage.setItem(STORAGE_KEY, String(scale));
    } catch {
      /* abaikan */
    }
  }, [scale]);

  function step(delta: number) {
    const i = STEPS.indexOf(scale as (typeof STEPS)[number]);
    const next = STEPS[Math.min(STEPS.length - 1, Math.max(0, i + delta))]!;
    setScale(next);
  }

  return (
    <div
      role="group"
      aria-label={en ? "Text size" : "Ukuran teks"}
      className="flex items-center gap-1 text-xs"
    >
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label={en ? "Decrease text size" : "Perkecil teks"}
        className="rounded border border-slate-300 px-2 py-1 font-semibold hover:bg-slate-100"
      >
        A−
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label={en ? "Increase text size" : "Perbesar teks"}
        className="rounded border border-slate-300 px-2 py-1 font-semibold hover:bg-slate-100"
      >
        A+
      </button>
      <span aria-live="polite" className="ml-1 w-10 text-slate-500">
        {scale}%
      </span>
    </div>
  );
}
