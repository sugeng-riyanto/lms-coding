"use client";

import { useState, useSyncExternalStore } from "react";
import type { CspAlertState } from "@/lib/csp-alerts";

/**
 * Panel "Security & monitoring" untuk admin (org-admin). Render state agregat
 * alerting CSP: banner spike (teks + ikon, bukan warna saja), kartu metrik
 * (rate, violations/blocked per menit, sample size, total, terakhir diperbarui)
 * dan tombol refresh yang membaca GET /api/operator/csp-alerts (role guru
 * server-side + rate-limit). Tidak pernah menampilkan URI/PII.
 */
export function SecurityMonitor({ initial }: { initial: CspAlertState }) {
  const [state, setState] = useState<CspAlertState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Format waktu hanya setelah mount agar tidak mismatch hidrasi (locale server
  // vs browser). useSyncExternalStore: server snapshot false, client true —
  // tanpa setState dalam effect (react-hooks/set-state-in-effect).
  const mounted = useSyncExternalStore(
    () => () => {}, // tidak ada subscribe (nilai berubah sekali saat mount)
    () => true,
    () => false,
  );

  const fmtTime = (ts: number | null): string =>
    ts === null || !mounted ? "—" : new Date(ts).toLocaleString("id-ID");

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/operator/csp-alerts", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: CspAlertState };
      if (!body.data) throw new Error("Respons tidak dikenal");
      setState(body.data);
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
            {busy ? "Memuat ulang…" : "Muat ulang"}
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

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Nilai agregat saja — tidak ada URI, detail directive, atau PII. State in-memory per proses server
          (multi-instance: DEPLOYMENT.md §7).
        </p>
      </div>
    </section>
  );
}
