/**
 * Kit visual dashboard (server-safe, tanpa client JS, tanpa dependensi baru).
 *
 * Prinsip: angka selalu berupa TEKS (bukan warna saja), ring/bar memakai
 * `role="progressbar"` + `aria-valuenow` agar terbaca screen reader, dan semua
 * permukaan memakai palet slate/blue/emerald/amber yang sudah dipetakan ke
 * dark mode di `globals.css` + varian `dark:` eksplisit untuk gradien.
 */
import { mkT, type Lang, type TextDict } from "@/lib/i18n";

export type StatTone = "blue" | "emerald" | "amber" | "rose" | "slate";

const TONE_BAR: Record<StatTone, string> = {
  blue: "from-blue-500 to-indigo-600",
  emerald: "from-emerald-500 to-teal-600",
  amber: "from-amber-400 to-orange-500",
  rose: "from-rose-400 to-pink-600",
  slate: "from-slate-300 to-slate-500",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <div className="card-lift overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-soft)] dark:bg-slate-900">
      <div className={`h-1.5 w-full bg-gradient-to-r ${TONE_BAR[tone]}`} aria-hidden="true" />
      <div className="p-4">
        <p className="text-3xl font-extrabold tracking-tight">{value}</p>
        <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
        {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

export function ProgressRing({ pct, size = 120, label }: { pct: number; size?: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (clamped / 100) * c;
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className="stroke-blue-600 dark:stroke-blue-400"
        />
      </svg>
      <span className="absolute text-xl font-extrabold">{clamped}%</span>
    </div>
  );
}

export function MeterBar({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
    >
      <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {hint && <p className="text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

/** State labels for the dashboard badge, per state key. */
export const STATE_TEXT = {
  locked: { id: "Terkunci", en: "Locked" },
  available: { id: "Tersedia", en: "Available" },
  in_progress: { id: "Dikerjakan", en: "In progress" },
  completed: { id: "Selesai", en: "Completed" },
} as const satisfies TextDict;

const STATE_STYLE: Record<string, { badge: string; dot: string }> = {
  locked: {
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-300 dark:bg-slate-600",
  },
  available: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  in_progress: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  completed: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

export function StateBadge({ state, label, lang = "id" }: { state: string; label?: string; lang?: Lang }) {
  const t = mkT(STATE_TEXT, lang);
  const s = STATE_STYLE[state] ?? STATE_STYLE["available"]!;
  const text = (
    state === "locked" || state === "available" || state === "in_progress" || state === "completed"
      ? t(state)
      : ""
  ) as string;
  return (
    <span
      aria-label={label ?? (text ? `Status ${text}` : state)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${s.badge}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${s.dot}`} />
      {text || state}
    </span>
  );
}
