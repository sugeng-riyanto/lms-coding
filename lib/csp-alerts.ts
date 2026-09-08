/**
 * Aggregator laporan CSP untuk alerting operator (kemungkinan injection
 * attempt). PRIMARY: Supabase table `csp_events` (restart-safe, multi-instance).
 * FALLBACK: in-memory ring buffer (dev/local mode, Supabase unavailable).
 *
 * Semua event (violation valid ATAU attempt yang di-block rate-limiter)
 * masuk ke tabel; "rate" = jumlah event dalam window bergulir. Spike =
 * rate ≥ threshold yang dikonfigurasi.
 *
 * Nilai agregat — TIDAK pernah menyimpan/menampilkan URI, script-sample,
 * atau PII (min disclosure).
 *
 * Untuk multi-instance: pindahkan ke Redis (DEPLOYMENT.md §7).
 */

import { createServiceClient } from "@/lib/supabase/service";

export interface CspAlertEvent {
  kind: "violation" | "blocked";
  at: number;
}

export interface CspAlertState {
  /** Spike aktif saat rate ≥ threshold dalam window bergulir. */
  alertActive: boolean;
  /** Event per menit dalam window saat ini. */
  ratePerMin: number;
  violationsPerMin: number;
  blockedPerMin: number;
  windowMs: number;
  thresholdPerMin: number;
  /** Banyak event dalam window (sample size — konvensi metrik proyek). */
  sampleSize: number;
  /** Total sejak query dimulai. */
  total: number;
  blockedTotal: number;
  lastViolationAt: number | null;
  lastUpdated: number;
}

// ---- Config ----
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_THRESHOLD_PER_MIN = 20;
const MAX_EVENTS = 2_000;

function windowMs(): number {
  return DEFAULT_WINDOW_MS;
}

function thresholdPerMin(): number {
  const raw = process.env.CSP_ALERT_THRESHOLD_PER_MIN;
  if (!raw) return DEFAULT_THRESHOLD_PER_MIN;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD_PER_MIN;
}

/** Check if Supabase env vars are available (server-side only). */
function hasSupabaseEnv(): boolean {
  return (
    typeof window === "undefined" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SECRET_KEY
  );
}

// ---- In-memory fallback (single instance, dev/local) ----
let memEvents: CspAlertEvent[] = [];
let memTotal = 0;
let memBlockedTotal = 0;

/** Insert event into Supabase table (service client, bypasses RLS). */
async function insertEvent(kind: CspAlertEvent["kind"]): Promise<void> {
  if (!hasSupabaseEnv()) return;
  try {
    const svc = createServiceClient();
    const { error } = await svc.from("csp_events").insert({ kind });
    if (error) {
      console.error("[csp-alerts] insert error:", error.message, error.code);
    }
  } catch (err) {
    console.error("[csp-alerts] insert failed:", err instanceof Error ? err.message : String(err));
  }
}

/** Read rolling window events from Supabase (service client). */
async function readWindowEvents(
  winMs: number,
  now: number,
): Promise<{
  violations: number;
  blocked: number;
  total: number;
  blockedTotal: number;
  lastViolationAt: number | null;
} | null> {
  if (!hasSupabaseEnv()) return null;
  try {
    const svc = createServiceClient();
    const since = new Date(now - winMs).toISOString();
    const { data, error } = await svc
      .from("csp_events")
      .select("kind, recorded_at")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false });
    if (error || !data) return null;
    const violations = data.filter((r) => r.kind === "violation").length;
    const blocked = data.filter((r) => r.kind === "blocked").length;
    const { count: totalCount } = await svc.from("csp_events").select("id", { count: "exact", head: true });
    const { count: blockedCount } = await svc
      .from("csp_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "blocked");
    const lastViolation = data.find((r) => r.kind === "violation");
    return {
      violations,
      blocked,
      total: totalCount ?? data.length,
      blockedTotal: blockedCount ?? blocked,
      lastViolationAt: lastViolation ? new Date(lastViolation.recorded_at).getTime() : null,
    };
  } catch {
    return null;
  }
}

// ---- Public API ----

/** Rekam satu event — Supabase primary, in-memory fallback. */
export function recordCspEvent(kind: CspAlertEvent["kind"], now = Date.now()): void {
  memEvents.push({ kind, at: now });
  if (memEvents.length > MAX_EVENTS) {
    memEvents = memEvents.slice(memEvents.length - MAX_EVENTS);
  }
  if (kind === "blocked") memBlockedTotal += 1;
  memTotal += 1;
  // Async insert into Supabase — fire-and-forget, errors logged not thrown.
  insertEvent(kind).catch(() => {});
}

export function recordCspViolation(now = Date.now()): void {
  recordCspEvent("violation", now);
}

export function recordCspBlocked(now = Date.now()): void {
  recordCspEvent("blocked", now);
}

/**
 * Hitung state agregat saat ini — Supabase primary, in-memory fallback.
 * Falls back to in-memory if Supabase read fails (dev/local mode).
 */
export async function cspAlertState(now = Date.now()): Promise<CspAlertState> {
  const win = windowMs();
  const thr = thresholdPerMin();

  // Try Supabase first.
  const db = await readWindowEvents(win, now);
  if (db !== null) {
    // Successfully read from Supabase.
    const scale = 60_000 / win;
    return {
      alertActive: db.violations + db.blocked >= thr,
      ratePerMin: Math.round((db.violations + db.blocked) * scale),
      violationsPerMin: Math.round(db.violations * scale),
      blockedPerMin: Math.round(db.blocked * scale),
      windowMs: win,
      thresholdPerMin: thr,
      sampleSize: db.violations + db.blocked,
      total: db.total,
      blockedTotal: db.blockedTotal,
      lastViolationAt: db.lastViolationAt,
      lastUpdated: now,
    };
  }

  // Fallback: in-memory.
  const inWindow = memEvents.filter((e) => now - e.at <= win);
  const violations = inWindow.filter((e) => e.kind === "violation").length;
  const blocked = inWindow.filter((e) => e.kind === "blocked").length;
  const rate = violations + blocked;
  const scale = 60_000 / win;
  const lastViolation = [...memEvents].reverse().find((e) => e.kind === "violation");
  return {
    alertActive: rate >= thr,
    ratePerMin: Math.round(rate * scale),
    violationsPerMin: Math.round(violations * scale),
    blockedPerMin: Math.round(blocked * scale),
    windowMs: win,
    thresholdPerMin: thr,
    sampleSize: inWindow.length,
    total: memTotal,
    blockedTotal: memBlockedTotal,
    lastViolationAt: lastViolation?.at ?? null,
    lastUpdated: now,
  };
}

/** Reset state — hanya untuk tests. */
export function __resetCspAlerts(): void {
  memEvents = [];
  memTotal = 0;
  memBlockedTotal = 0;
}
