"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { CspAlertState } from "@/lib/csp-alerts";
import { ColumnChart } from "@/components/charts";
import { fmt, mkT, localeFor, type Lang } from "@/lib/i18n";
import { SECURITY } from "@/lib/ui-text/security";

/**
 * Panel "Security & monitoring" untuk admin (org-admin). Render state agregat
 * alerting CSP: banner spike (teks + ikon, bukan warna saja), kartu metrik
 * (rate, violations/blocked per menit, sample size, total, terakhir diperbarui),
 * tombol refresh, dan grafik riwayat 24 jam / 7 hari dari persisted csp_events
 * table. Tidak pernah menampilkan URI/PII.
 */
interface DigestBucket {
  bucket: string;
  violations: number;
  blocked: number;
}

export function SecurityMonitor({ initial, lang }: { initial: CspAlertState; lang: Lang }) {
  const t = mkT(SECURITY, lang);
  const [state, setState] = useState<CspAlertState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digestBuckets, setDigestBuckets] = useState<DigestBucket[]>([]);
  const [digestTotal, setDigestTotal] = useState(0);
  const [chartDays, setChartDays] = useState<1 | 7>(1);

  // Format waktu hanya setelah mount agar tidak mismatch hidrasi.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const fmtTime = (ts: number | null): string =>
    ts === null || !mounted ? "\u2014" : new Date(ts).toLocaleString(localeFor(lang));

  const fetchDigest = useCallback(async (days: 1 | 7) => {
    const res = await fetch(`/api/operator/csp-digest?days=${days}`, { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as {
      data?: { buckets?: DigestBucket[]; total?: number };
    };
    if (body.data?.buckets) setDigestBuckets(body.data.buckets);
    if (body.data?.total != null) setDigestTotal(body.data.total);
  }, []);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const [alertRes] = await Promise.all([
        fetch("/api/operator/csp-alerts", { cache: "no-store" }),
        fetchDigest(chartDays),
      ]);
      if (!alertRes.ok) throw new Error(`HTTP ${alertRes.status}`);
      const alertBody = (await alertRes.json()) as { data?: CspAlertState };
      if (!alertBody.data) throw new Error(t("unknownResponse"));
      setState(alertBody.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("refreshFailedGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function switchDays(days: 1 | 7) {
    if (days === chartDays) return;
    setChartDays(days);
    setBusy(true);
    try {
      await fetchDigest(days);
    } catch {
      // silent — chart just stays stale
    } finally {
      setBusy(false);
    }
  }

  const cards: { label: string; value: string; hint?: string }[] = [
    {
      label: t("cardRate"),
      value: `${state.ratePerMin}${t("cardRateUnit")}`,
      hint: fmt(t("cardRateHint"), { threshold: state.thresholdPerMin }),
    },
    { label: t("cardViolations"), value: String(state.violationsPerMin) },
    { label: t("cardBlocked"), value: String(state.blockedPerMin) },
    {
      label: t("cardSample"),
      value: String(state.sampleSize),
      hint: fmt(t("cardSampleHint"), { seconds: state.windowMs / 1000 }),
    },
    { label: t("cardTotal"), value: String(state.total) },
    { label: t("cardBlockedTotal"), value: String(state.blockedTotal) },
    { label: t("cardLastViolation"), value: fmtTime(state.lastViolationAt) },
    { label: t("cardLastUpdated"), value: fmtTime(state.lastUpdated) },
  ];

  // Build chart bars from digest buckets.
  const chartBars = digestBuckets.map((b) => ({
    label: chartDays === 7 ? b.bucket.slice(5, 10) : b.bucket.slice(11, 16), // "MM-DD" or "HH:MM"
    value: b.violations + b.blocked,
    hint: fmt(t("barHint"), { v: b.violations, b: b.blocked }),
  }));

  const chartLabel = chartDays === 7 ? t("chart7d") : t("chart24");
  const chartAriaLabel =
    chartDays === 7
      ? "CSP violations per day over the last 7 days"
      : "CSP violations per hour over the last 24 hours";

  return (
    <section
      aria-label={t("sectionAria")}
      className="card-lift overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-soft)] dark:bg-slate-900"
    >
      <div aria-hidden="true" className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{t("heading")}</h2>
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-[var(--shadow-soft)] transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            {busy ? t("refreshing") : t("refresh")}
          </button>
        </div>

        {state.alertActive ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-xl border-2 border-red-400 bg-red-50 p-4 text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-100"
          >
            <span aria-hidden="true" className="text-xl">
              ⚠️
            </span>
            <span>
              <strong>{t("alertSpike")}</strong> {t("alertBody")}
            </span>
          </p>
        ) : (
          <p
            role="status"
            className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
          >
            <span aria-hidden="true" className="text-xl">
              ✅
            </span>
            <span>
              <strong>{t("noSpike")}</strong> {fmt(t("noSpikeBody"), { threshold: state.thresholdPerMin })}
            </span>
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {fmt(t("refreshFailed"), { error })}
          </p>
        )}

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
            >
              <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {c.label}
              </dt>
              <dd className="mt-1 font-bold tabular-nums">{c.value}</dd>
              {c.hint && <dd className="text-xs text-slate-500 dark:text-slate-400">{c.hint}</dd>}
            </div>
          ))}
        </dl>

        {/* CSP history chart with 24h/7d toggle — only shown when digest data is loaded. */}
        {chartBars.length > 0 && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {chartLabel}
                <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                  {fmt(t("chartTotal"), { total: digestTotal })}
                </span>
              </h3>
              {/* Toggle: 24h / 7d */}
              <div
                className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                role="radiogroup"
                aria-label={t("chartRangeAria")}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={chartDays === 1}
                  onClick={() => switchDays(1)}
                  disabled={busy}
                  className={`px-3 py-1 text-xs font-semibold transition ${
                    chartDays === 1
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {t("range24h")}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chartDays === 7}
                  onClick={() => switchDays(7)}
                  disabled={busy}
                  className={`px-3 py-1 text-xs font-semibold transition ${
                    chartDays === 7
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {t("range7d")}
                </button>
              </div>
            </div>
            <div className="mt-2">
              <ColumnChart
                bars={chartBars}
                ariaLabel={chartAriaLabel}
                tone="amber"
                trackHeight={80}
                formatValue={(v) => String(v)}
              />
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t("footer")}</p>
      </div>
    </section>
  );
}
