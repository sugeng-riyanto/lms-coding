"use client";

import { useState, useSyncExternalStore } from "react";
import type { CspAlertState } from "@/lib/csp-alerts";
import { ColumnChart } from "@/components/charts";

/**
 * Panel "Security & monitoring" untuk admin (org-admin). Render state agregat
 * alerting CSP: banner spike (teks + ikon, bukan warna saja), kartu metrik
 * (rate, violations/blocked per menit, sample size, total, terakhir diperbarui),
 * tombol refresh, dan grafik riwayat 24 jam dari persisted csp_events table.
 * Tidak pernah menampilkan URI/PII.
 */
interface DigestHour {
  hour: string;
  violations: number;
  blocked: number;
}

export function SecurityMonitor({ initial }: { initial: CspAlertState }) {
  const [state, setState] = useState<CspAlertState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digestHours, setDigestHours] = useState<DigestHour[]>([]);
  const [digestTotal, setDigestTotal] = useState(0);

  // Format waktu hanya setelah mount agar tidak mismatch hidrasi.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const fmtTime = (ts: number | null): string =>
    ts === null || !mounted ? "\u2014" : new Date(ts).toLocaleString("id-ID");

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const [alertRes, digestRes] = await Promise.all([
        fetch("/api/operator/csp-alerts", { cache: "no-store" }),
        fetch("/api/operator/csp-digest", { cache: "no-store" }),
      ]);
      if (!alertRes.ok) throw new Error(`HTTP ${alertRes.status}`);
      const alertBody = (await alertRes.json()) as { data?: CspAlertState };
      if (!alertBody.data) throw new Error("Respons tidak dikenal");
      setState(alertBody.data);

      if (digestRes.ok) {
        const digestBody = (await digestRes.json()) as {
          data?: { hours?: DigestHour[]; total24h?: number };
        };
        if (digestBody.data?.hours) setDigestHours(digestBody.data.hours);
        if (digestBody.data?.total24h != null) setDigestTotal(digestBody.data.total24h);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat ulang.");
    } finally {
      setBusy(false);
    }
  }

  const cards: { label: string; value: string; hint?: string }[] = [
    {
      label: "Rate saat ini",
      value: `${state.ratePerMin}/menit`,
      hint: `ambang ${state.thresholdPerMin}/menit`,
    },
    { label: "Pelanggaran / menit", value: String(state.violationsPerMin) },
    { label: "Diblokir rate-limiter / menit", value: String(state.blockedPerMin) },
    { label: "Sample (jendela)", value: String(state.sampleSize), hint: `${state.windowMs / 1000} detik` },
    { label: "Total sejak proses start", value: String(state.total) },
    { label: "Total diblokir", value: String(state.blockedTotal) },
    { label: "Pelanggaran terakhir", value: fmtTime(state.lastViolationAt) },
    { label: "Terakhir diperbarui", value: fmtTime(state.lastUpdated) },
  ];

  // Build chart bars from digest hours (last 24h, hourly buckets).
  const chartBars = digestHours.map((h) => ({
    label: h.hour.slice(11, 16), // "HH:MM"
    value: h.violations + h.blocked,
    hint: `V:${h.violations} B:${h.blocked}`,
  }));

  return (
    <section
      aria-label="Monitoring laporan CSP"
      className="card-lift overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-soft)] dark:bg-slate-900"
    >
      <div aria-hidden="true" className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Security &amp; monitoring</h2>
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-[var(--shadow-soft)] transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            {busy ? "Memuat ulang\u2026" : "Muat ulang"}
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
              <strong>Spike laporan CSP terdeteksi</strong> — kemungkinan percobaan injection. Periksa baris
              log <code className="rounded bg-red-100 px-1 dark:bg-red-900">csp-alert</code> dan endpoint{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900">/api/csp-report</code> (DEPLOYMENT.md
              §7.3).
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
              <strong>Tidak ada spike laporan CSP.</strong> Rate saat ini di bawah ambang{" "}
              {state.thresholdPerMin}/menit.
            </span>
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            Gagal memuat ulang: {error}
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

        {/* 24h mini history chart — only shown when digest data is loaded. */}
        {chartBars.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Riwayat 24 jam
              <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                Total: {digestTotal} event
              </span>
            </h3>
            <div className="mt-2">
              <ColumnChart
                bars={chartBars}
                ariaLabel="CSP violations per hour over the last 24 hours"
                tone="amber"
                trackHeight={80}
                formatValue={(v) => String(v)}
              />
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Nilai agregat saja — tidak ada URI, detail directive, atau PII. State persisted di Supabase table{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">csp_events</code> (restart-safe,
          multi-instance). Grafik menampilkan data 24 jam terakhir dari tabel yang sama.
        </p>
      </div>
    </section>
  );
}
