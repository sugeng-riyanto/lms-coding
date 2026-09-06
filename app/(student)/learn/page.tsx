import Link from "next/link";
import { nextBestAction } from "@/lib/progress";

const DEMO_LEVELS = [
  {
    id: "lvl-1",
    title: "Level 1 — Fondasi",
    mastery: 1,
    locked: false,
    deadlineInDays: null as number | null,
    lastActivityDaysAgo: 1,
  },
  {
    id: "lvl-2",
    title: "Level 2 — Penerapan",
    mastery: 0.45,
    locked: false,
    deadlineInDays: 2,
    lastActivityDaysAgo: 0,
  },
  {
    id: "lvl-3",
    title: "Level 3 — Proyek",
    mastery: 0,
    locked: true,
    deadlineInDays: null,
    lastActivityDaysAgo: null,
  },
];

export default function LearnPage() {
  const rec = nextBestAction(DEMO_LEVELS);

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold text-blue-700">Halo, Pelajar 👋</p>
      <h1 className="mt-1 text-3xl font-bold">Target hari ini</h1>
      {rec ? (
        <section aria-label="Rekomendasi" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold">Lanjutkan belajar</h2>
          <p className="mt-1">{rec.reason}</p>
          <Link
            href={`/learn/${rec.id}`}
            className="mt-3 inline-block rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
          >
            Lanjutkan belajar
          </Link>
        </section>
      ) : (
        <p className="mt-4 rounded-xl border p-5">Belum ada rekomendasi — semua terkunci atau selesai. 🎉</p>
      )}

      <h2 className="mt-8 text-xl font-semibold">Peta level</h2>
      <ol className="mt-3 space-y-3">
        {DEMO_LEVELS.map((l) => (
          <li key={l.id} className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="font-semibold">{l.title}</p>
              <p className="text-sm text-slate-600">
                {l.locked ? "Terkunci — selesaikan prerequisite" : `Mastery ${Math.round(l.mastery * 100)}%`}
              </p>
            </div>
            <span
              aria-label={`Status ${l.title}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold"
            >
              {l.locked ? "Locked" : l.mastery >= 1 ? "Completed" : "Available"}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-slate-500">
        Data di atas memakai Server Actions + Supabase saat backend tersedia; fallback demo anonim agar UI
        tidak kosong tanpa janji palsu.
      </p>
    </main>
  );
}
