/**
 * Aggregator laporan CSP untuk alerting operator (kemungkinan injection
 * attempt). Murni (tanpa I/O) agar mudah diuji.
 *
 * Semua event (violation valid ATAU attempt yang di-block rate-limiter)
 * masuk ke ring buffer ber-timestamp; "rate" = jumlah event dalam window
 * bergulir. Spike = rate ≥ threshold yang dikonfigurasi. Nilai agregat —
 * TIDAK pernah menyimpan/menampilkan URI, script-sample, atau PII.
 *
 * State in-memory per proses (single instance — sama seperti lib/ratelimit.ts).
 * Untuk multi-instance, pindahkan agregasi ke Redis/Supabase (DEPLOYMENT.md §7).
 */
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
  /** Total sejak proses start. */
  total: number;
  blockedTotal: number;
  lastViolationAt: number | null;
  lastUpdated: number;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_THRESHOLD_PER_MIN = 20;
/** Batas ring buffer — mencegah pertumbuhan memori tak terbatas. */
const MAX_EVENTS = 2_000;

let events: CspAlertEvent[] = [];
let total = 0;
let blockedTotal = 0;

function windowMs(): number {
  return DEFAULT_WINDOW_MS;
}

function thresholdPerMin(): number {
  const raw = process.env.CSP_ALERT_THRESHOLD_PER_MIN;
  if (!raw) return DEFAULT_THRESHOLD_PER_MIN;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD_PER_MIN;
}

/** Rekam satu event (violation atau attempt yang di-block). */
export function recordCspEvent(kind: CspAlertEvent["kind"], now = Date.now()): void {
  events.push({ kind, at: now });
  if (events.length > MAX_EVENTS) {
    events = events.slice(events.length - MAX_EVENTS);
  }
  if (kind === "blocked") blockedTotal += 1;
  total += 1;
}

export function recordCspViolation(now = Date.now()): void {
  recordCspEvent("violation", now);
}

export function recordCspBlocked(now = Date.now()): void {
  recordCspEvent("blocked", now);
}

/** Hitung state agregat saat ini (murni; tidak mengubah state). */
export function cspAlertState(now = Date.now()): CspAlertState {
  const win = windowMs();
  const thr = thresholdPerMin();
  const inWindow = events.filter((e) => now - e.at <= win);
  const violations = inWindow.filter((e) => e.kind === "violation").length;
  const blocked = inWindow.filter((e) => e.kind === "blocked").length;
  const rate = violations + blocked;
  const scale = 60_000 / win; // rate per menit (linear scaling window)
  const lastViolation = [...events].reverse().find((e) => e.kind === "violation");
  return {
    alertActive: rate >= thr,
    ratePerMin: Math.round(rate * scale),
    violationsPerMin: Math.round(violations * scale),
    blockedPerMin: Math.round(blocked * scale),
    windowMs: win,
    thresholdPerMin: thr,
    sampleSize: inWindow.length,
    total,
    blockedTotal,
    lastViolationAt: lastViolation?.at ?? null,
    lastUpdated: now,
  };
}

/** Reset state — hanya untuk tests. */
export function __resetCspAlerts(): void {
  events = [];
  total = 0;
  blockedTotal = 0;
}
