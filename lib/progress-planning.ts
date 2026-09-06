/**
 * Target mingguan & spaced review — logika MURNI (tanpa I/O), sesuai
 * LEARNING_ENGINE.md: target mingguan personal + retrieval practice 1/3/7/14
 * hari dengan interval dapat dikonfigurasi.
 *
 * Konvensi: semua instant disimpan/dibandingkan dalam UTC; batas "minggu" dan
 * "hari ini" dihitung dalam timezone org (Asia/Jakarta default via lib/time).
 */
import { DISPLAY_TIMEZONE } from "@/lib/time";
import { clampSessionActiveSeconds } from "@/lib/active-time";

export const DEFAULT_REVIEW_INTERVALS_DAYS = [1, 3, 7, 14] as const;
export const DEFAULT_WEEKLY_GOAL = 3;
export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 50;
/** Default target menit per minggu (flip ADR-010; ~2 jam belajar aktif). */
export const DEFAULT_WEEKLY_GOAL_MINUTES = 120;
export const WEEKLY_GOAL_MAX_MINUTES = 2000;

export type WeeklyGoalUnit = "completions" | "minutes";

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Tanggal kalender (Y-M-D) dari instant, dalam timezone tertentu. */
function zonedYmd(ts: Date, tz: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ts);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Offset (local − UTC) dalam menit pada instant ts di timezone tz. */
function tzOffsetMinutes(ts: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(ts);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((wallAsUtc - ts.getTime()) / 60_000);
}

/** Waktu lokal (y,m,d,h,min di tz) → instant UTC (iterasi koreksi offset). */
function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = new Date(target);
  for (let i = 0; i < 3; i++) {
    guess = new Date(target - tzOffsetMinutes(guess, tz) * 60_000);
  }
  return guess;
}

function toDateStr(utcMidnightMs: number): string {
  const d = new Date(utcMidnightMs);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Senin minggu ISO (sebagai "YYYY-MM-DD") untuk instant ts, dihitung dalam
 * kalender timezone tz. Contoh: Minggu 2026-09-06 23:00 UTC sudah Senin
 * 2026-09-07 di Asia/Jakarta → week_start "2026-09-07".
 */
export function isoWeekStart(ts: Date, tz: string = DISPLAY_TIMEZONE): string {
  const { year, month, day } = zonedYmd(ts, tz);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Minggu
  const daysSinceMonday = (dow + 6) % 7;
  return toDateStr(Date.UTC(year, month - 1, day) - daysSinceMonday * DAY_MS);
}

/** true bila instant ts berada pada minggu yang week_start-nya sama. */
export function isSameIsoWeek(ts: Date, weekStart: string, tz: string = DISPLAY_TIMEZONE): boolean {
  return isoWeekStart(ts, tz) === weekStart;
}

/**
 * Awal hari BERIKUTNYA (00:00 besok) dalam kalender timezone tz, sebagai
 * instant UTC. Dipakai batas "jatuh tempo hari ini": due_at < hasil ini
 * berarti masih boleh dikerjakan hari ini.
 */
export function startOfNextDayInTz(ts: Date, tz: string = DISPLAY_TIMEZONE): Date {
  const { year, month, day } = zonedYmd(ts, tz);
  return zonedToUtc(year, month, day + 1, 0, 0, tz);
}

export interface WeeklyRollupInput {
  /** Banyak entity yang bertransisi ke "completed" pada minggu berjalan. */
  completedThisWeek: number;
  goalValue: number;
}

export interface WeeklyRollup {
  completed: number;
  goal: number;
  /** 0–100, di-clamp; dibulatkan. */
  pct: number;
  achieved: boolean;
  status: "active" | "completed";
}

/** Rollup progress vs target mingguan (completions). */
export function weeklyRollup(input: WeeklyRollupInput): WeeklyRollup {
  const completed = Math.max(0, Math.floor(input.completedThisWeek));
  const goal = Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, Math.floor(input.goalValue)));
  const achieved = completed >= goal;
  const pct = Math.min(100, Math.round((completed / goal) * 100));
  return { completed, goal, pct, achieved, status: achieved ? "completed" : "active" };
}

/**
 * Clamp goal sesuai unit (ADR-010 / rencana minutes): completions 1..50,
 * minutes 1..2000 (~33 jam/minggu). Goal menit TIDAK boleh ter-clamp ke 50.
 */
export function clampGoalForUnit(unit: WeeklyGoalUnit, goalValue: number): number {
  const v = Math.floor(goalValue);
  if (!Number.isFinite(v)) return unit === "minutes" ? DEFAULT_WEEKLY_GOAL_MINUTES : DEFAULT_WEEKLY_GOAL;
  if (unit === "minutes") return Math.min(WEEKLY_GOAL_MAX_MINUTES, Math.max(WEEKLY_GOAL_MIN, v));
  return Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, v));
}

export interface StudySessionRow {
  /** timestamptz ISO. */
  started_at: string;
  active_seconds: number;
}

/**
 * Menit aktif dalam minggu ISO (tz org) dari baris study_sessions: jumlah
 * active_seconds (di-clamp per sesi) untuk sesi yang MULAI di minggu itu,
 * dibagi 60.000 lalu di-floor. Sesi panjang yang menyeberang tengah malam
 * dibukukan ke minggu mulai-nya (definisi didokumentasikan; delta per
 * heartbeat sudah di-clamp server di write path).
 */
export function weeklyActiveMinutes(
  sessions: StudySessionRow[],
  weekStart: string,
  tz: string = DISPLAY_TIMEZONE,
): number {
  let totalSec = 0;
  for (const s of sessions) {
    if (!isSameIsoWeek(new Date(s.started_at), weekStart, tz)) continue;
    totalSec += clampSessionActiveSeconds(s.active_seconds);
  }
  return Math.floor(totalSec / 60);
}

/** Format menit ramah-murid: "5 m", "125 m" → "2 j 5 m". */
export function formatActiveMinutes(mins: number): string {
  const m = Math.max(0, Math.floor(mins));
  if (m < 60) return `${m} m`;
  return `${Math.floor(m / 60)} j ${m % 60} m`;
}

/**
 * Rollup unit-aware: `measured` = jumlah completions ATAU menit aktif.
 * Field `completed` pada hasil dipakai sebagai nilai terukur (back-compat
 * dengan struktur WeeklyRollup yang dipakai UI /learn).
 */
export function weeklyRollupForUnit(unit: WeeklyGoalUnit, measured: number, goalValue: number): WeeklyRollup {
  const completed = Math.max(0, Math.floor(measured));
  const goal = clampGoalForUnit(unit, goalValue);
  const achieved = completed >= goal;
  const pct = Math.min(100, Math.round((completed / goal) * 100));
  return { completed, goal, pct, achieved, status: achieved ? "completed" : "active" };
}

function addDays(ts: Date, days: number): Date {
  return new Date(ts.getTime() + days * DAY_MS);
}

export interface ReviewDue {
  /** Index interval 1-based di dalam ladder (cap di interval terakhir). */
  intervalIdx: number;
  dueAt: Date;
}

/**
 * Jadwal review PERTAMA setelah entity selesai dipelajari:
 * interval pertama ladder (default +1 hari).
 */
export function firstReviewDue(
  completedAt: Date,
  intervals: readonly [number, ...number[]] = DEFAULT_REVIEW_INTERVALS_DAYS,
): ReviewDue {
  return { intervalIdx: 1, dueAt: addDays(completedAt, intervals[0]) };
}

/**
 * Interval berikutnya menurut confidence (retrieval practice):
 * - confidence ≥ 4 → maju satu anak tangga (cap di interval terakhir);
 * - confidence = 3 → ulangi interval yang sama;
 * - confidence ≤ 2 → reset ke interval pertama.
 * due_at dihitung dari completedAt (instant selesainya review ≈ "now").
 */
export function nextReviewAfter(input: {
  completedAt: Date;
  confidence: number;
  intervalIdx?: number;
  intervals?: readonly [number, ...number[]];
}): ReviewDue {
  const intervals = input.intervals ?? DEFAULT_REVIEW_INTERVALS_DAYS;
  const current = Math.min(intervals.length, Math.max(1, Math.floor(input.intervalIdx ?? 1)));
  let next: number;
  if (input.confidence >= 4) next = Math.min(current + 1, intervals.length);
  else if (input.confidence <= 2) next = 1;
  else next = current;
  // next dijamin 1..intervals.length oleh clamp/cap di atas.
  return { intervalIdx: next, dueAt: addDays(input.completedAt, intervals[next - 1]!) };
}

export interface FirstReviewInsertRow {
  enrollment_id: string;
  entity_type: "level";
  entity_id: string;
  /** ISO UTC timestamptz. */
  due_at: string;
  interval_idx: number;
  status: "scheduled";
}

/**
 * Baris review PERTAMA utk level yang baru selesai (hook aplikasi ADR-011):
 * interval ladder pertama sejak `now`. Id unik + urutan stabil (sort) agar
 * deterministik; caller mem-filter entity yang sudah punya baris review agar
 * recompute ulang tidak menggandakan (index parsial jadi jaminan terakhir).
 */
export function firstReviewInsertRows(
  enrollmentId: string,
  entityIds: string[],
  now: Date = new Date(),
  intervals: readonly [number, ...number[]] = DEFAULT_REVIEW_INTERVALS_DAYS,
): FirstReviewInsertRow[] {
  const due = firstReviewDue(now, intervals);
  const uniqueIds = [...new Set(entityIds)].sort();
  return uniqueIds.map((entityId) => ({
    enrollment_id: enrollmentId,
    entity_type: "level",
    entity_id: entityId,
    due_at: due.dueAt.toISOString(),
    interval_idx: due.intervalIdx,
    status: "scheduled",
  }));
}

export interface ReviewQueueCandidate {
  id: string;
  title: string;
  dueAt: Date;
  /** 0–1; tie-break setelah due date. */
  mastery: number;
}

/**
 * Urutkan antrian review: overdue → jatuh tempo hari ini → berikutnya; dalam
 * tier yang sama urut due_at naik, lalu mastery terendah, lalu id (stabil).
 * Tidak memodifikasi array masukan.
 */
export function orderedReviewQueue(
  candidates: ReviewQueueCandidate[],
  opts: { now: Date; tz?: string },
): ReviewQueueCandidate[] {
  const tz = opts.tz ?? DISPLAY_TIMEZONE;
  const nowMs = opts.now.getTime();
  // Batas "hari ini": 00:00 besok waktu lokal di tz.
  const { year, month, day } = zonedYmd(opts.now, tz);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const todayEnd = zonedToUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    0,
    0,
    tz,
  ).getTime();

  const tier = (dueMs: number): number => (dueMs <= nowMs ? 0 : dueMs < todayEnd ? 1 : 2);
  return [...candidates].sort((a, b) => {
    const ta = tier(a.dueAt.getTime());
    const tb = tier(b.dueAt.getTime());
    if (ta !== tb) return ta - tb;
    if (a.dueAt.getTime() !== b.dueAt.getTime()) return a.dueAt.getTime() - b.dueAt.getTime();
    if (a.mastery !== b.mastery) return a.mastery - b.mastery;
    return a.id.localeCompare(b.id);
  });
}
