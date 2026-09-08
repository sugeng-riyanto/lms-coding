import type { ReactNode } from "react";
import { fmt, mkT, type Lang } from "@/lib/i18n";
// Dictionary teks grafik dipisah ke lib/ui-text (bukan data inline di
// komponen): id/en adalah DATA — halaman/komponen hanya memakai via t()/mkT.
export { CHART_TEXT } from "@/lib/ui-text/chart-kit";
import { CHART_TEXT } from "@/lib/ui-text/chart-kit";

/**
 * Kit grafik ringan — SERVER-SAFE (tanpa JS klien, tanpa dependensi baru).
 *
 * Semua angka TETAP berupa teks (label nilai di atas batang + <title>),
 * bukan warna saja; daftar nilai lengkap tersedia sr-only. Warna mengikuti
 * token elevasi/status (light + dark) di globals.css.
 */

export interface ChartBar {
  label: string;
  /** Nilai ≥ 0. */
  value: number;
  /** Teks tambahan (mis. "Percobaan 2") untuk tooltip/aksesibilitas. */
  hint?: string;
}

type ChartTone = "blue" | "emerald" | "amber";

const TONE_GRADIENT: Record<ChartTone, string> = {
  blue: "from-blue-500 to-indigo-600",
  emerald: "from-emerald-500 to-teal-600",
  amber: "from-amber-400 to-orange-500",
};

const TONE_TEXT: Record<ChartTone, string> = {
  blue: "text-blue-700 dark:text-blue-300",
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
};

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Diagram batang kolom responsif (server-safe). `scaleMax` opsional untuk
 * skala tetap (mis. 100 untuk persen); default = nilai terbesar (min 1).
 */
export function ColumnChart({
  bars,
  ariaLabel,
  formatValue = (v: number) => String(Math.round(v)),
  suffix = "",
  tone = "blue",
  scaleMax,
  trackHeight = 132,
  lang = "id",
}: {
  bars: ChartBar[];
  ariaLabel: string;
  formatValue?: (v: number) => string;
  suffix?: string;
  tone?: ChartTone;
  scaleMax?: number;
  trackHeight?: number;
  lang?: Lang;
}) {
  const t = mkT(CHART_TEXT, lang);
  const safe = bars.map((b) => ({
    label: typeof b.label === "string" ? b.label : "",
    value: asNumber(b.value),
    hint: typeof b.hint === "string" ? b.hint : undefined,
  }));
  const maxRaw = Math.max(...safe.map((b) => b.value), scaleMax ?? 1);
  const max = Math.max(1, maxRaw);
  const px = (v: number) => (v <= 0 ? 0 : Math.max(3, Math.round((v / max) * trackHeight)));

  return (
    <figure className="w-full">
      <div role="img" aria-label={ariaLabel} className="w-full">
        <div className="flex items-end gap-1.5 sm:gap-3" style={{ height: trackHeight + 22 }}>
          {safe.map((b, i) => {
            const h = px(b.value);
            const tip = b.hint ? `${b.label} — ${b.hint}: ${formatValue(b.value)}${suffix}` : undefined;
            return (
              <div
                key={`${b.label}-${i}`}
                className="flex min-w-0 flex-1 flex-col items-center justify-end"
                aria-hidden="true"
              >
                <span className={`text-[10px] leading-4 font-bold tabular-nums ${TONE_TEXT[tone]}`}>
                  {b.value > 0 ? `${formatValue(b.value)}${suffix}` : "\u00A0"}
                </span>
                <div className="w-full">
                  {b.value > 0 ? (
                    <div
                      title={tip ?? `${b.label}: ${formatValue(b.value)}${suffix}`}
                      className={`w-full rounded-t-md bg-gradient-to-t ${TONE_GRADIENT[tone]} shadow-[var(--shadow-soft)]`}
                      style={{ height: h }}
                    />
                  ) : (
                    <div
                      title={fmt(t("noData"), { label: b.label })}
                      className="mx-auto h-1 w-full rounded-full bg-slate-200 dark:bg-slate-700"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1.5 sm:gap-3">
          {safe.map((b, i) => (
            <span
              key={`${b.label}-x-${i}`}
              title={b.label}
              className="min-w-0 flex-1 truncate text-center text-[10px] font-medium text-slate-500 dark:text-slate-400"
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">
        {fmt(t("valuePerCategory"), {
          values: safe.map((b) => `${b.label} ${formatValue(b.value)}${suffix}`).join("; "),
        })}
      </figcaption>
    </figure>
  );
}

/** Panel grafik standar: judul, definisi singkat, pembaruan + catatan kaki. */
export function ChartPanel({
  title,
  desc,
  updatedAt,
  footnote,
  empty,
  children,
  lang = "id",
}: {
  title: string;
  desc?: string;
  updatedAt?: string;
  footnote?: string;
  empty?: string;
  children?: ReactNode;
  lang?: Lang;
}) {
  const t = mkT(CHART_TEXT, lang);
  return (
    <section
      aria-label={title}
      className="card-lift flex flex-col rounded-2xl border bg-white p-5 shadow-[var(--shadow-soft)] dark:bg-slate-900"
    >
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {desc && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{desc}</p>}
      <div className="mt-4 flex-1">
        {empty ? (
          <p
            role="status"
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {empty}
          </p>
        ) : (
          children
        )}
      </div>
      {(updatedAt || footnote) && (
        <p className="mt-4 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500">
          {updatedAt && <>{fmt(t("updated"), { at: updatedAt })}</>}
          {updatedAt && footnote && " "}
          {footnote}
        </p>
      )}
    </section>
  );
}
