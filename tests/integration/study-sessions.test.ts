import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Write path study_sessions + flip target mingguan ke menit (ADR-010).
 * Bukti statis — perilaku nyata (RLS read-only, RPC clamp, CHECK unit-aware,
 * RLS lintas murid) diuji live di scripts/live-denial (t16_*).
 */
const actions = readFileSync("features/actions.ts", "utf8");
const lib = readFileSync("lib/progress-planning.ts", "utf8");
const activeTime = readFileSync("lib/active-time.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260906000016_study_sessions_write_path.sql", "utf8");
const validation = readFileSync("lib/validation.ts", "utf8");

describe("migration 000016 — RLS read-only + RPC append + CHECK unit-aware", () => {
  it("policy tulis murid dihapus, diganti select-only (anti pemalsuan menit)", () => {
    expect(migration).toMatch(/drop policy if exists sessions_student_rw on public\.study_sessions/);
    expect(migration).toMatch(/create policy sessions_student_select on public\.study_sessions for select/);
    expect(migration).toMatch(/e\.student_id = auth\.uid\(\) and e\.status = 'active'/);
    // Policy guru cohort dari 000002 tetap dipertahankan (komentar eksplisit).
    expect(migration).toMatch(/sessions_teacher_select \(cohort\) tetap dari 000002/);
  });

  it("append_study_session di schema private: definer, search_path, clamp, gap sesi", () => {
    expect(migration).toMatch(/create or replace function private\.append_study_session/);
    expect(migration).toMatch(/security definer set search_path = ''/);
    // Clamp server-side: delta ≤ 120 s; sesi lanjutan gap ≤ 10 menit.
    expect(migration).toMatch(/least\(p_active_ms, 120000\)/);
    expect(migration).toMatch(/interval '10 minutes'/);
    // Batas keamanan active_seconds per sesi (6 jam).
    expect(migration).toMatch(/least\(active_seconds \+ v_ms, 21600\)/);
    // occurred_at di-clamp ke jendela wajar (anti backdate/future).
    expect(migration).toMatch(/interval '5 minutes'/);
    expect(migration).toMatch(/interval '24 hours'/);
  });

  it("wrapper publik di-revoke dari public/anon/authenticated (server-only)", () => {
    expect(migration).toMatch(/create or replace function public\.append_study_session/);
    expect(migration).toMatch(
      /revoke all on function public\.append_study_session\(uuid, int, timestamptz\) from public, anon, authenticated/,
    );
  });

  it("goal_value unit-aware: completions 1..50, minutes 1..2000", () => {
    expect(migration).toMatch(/drop constraint if exists weekly_plans_goal_value_check/);
    expect(migration).toMatch(/add constraint weekly_plans_goal_value_unit_aware/);
    expect(migration).toMatch(/goal_unit = 'completions' and goal_value between 1 and 50/);
    expect(migration).toMatch(/goal_unit = 'minutes' and goal_value between 1 and 2000/);
  });
});

describe("recordLearningEvent → append study session (write path)", () => {
  it("heartbeat yang diterima menambah active seconds via service client", () => {
    const body = actions.slice(
      actions.indexOf("export async function recordLearningEvent"),
      actions.indexOf("// ---------- Target mingguan"),
    );
    expect(body).toMatch(/validateHeartbeatMetadata\(metadata\)/);
    expect(body).toMatch(/eventType === "heartbeat"/);
    expect(body).toMatch(/createServiceClient\(\)/);
    expect(body).toMatch(/rpc\("append_study_session"/);
    expect(body).toMatch(/p_active_ms: heartbeatActiveMs/);
  });

  it("append bersifat best-effort: kegagalan agregasi tidak menggagalkan event", () => {
    const body = actions.slice(
      actions.indexOf("export async function recordLearningEvent"),
      actions.indexOf("// ---------- Target mingguan"),
    );
    expect(body).toMatch(/Best-effort/);
  });
});

describe("setWeeklyGoal — action + schema", () => {
  it("schema membatasi unit & nilai (1..2000), clamp per unit di server", () => {
    expect(validation).toMatch(/export const setWeeklyGoalSchema = z\.object\(\{/);
    expect(validation).toMatch(/unit: z\.enum\(\["completions", "minutes"\]\)/);
    expect(validation).toMatch(/value: z\.number\(\)\.int\(\)\.min\(1\)\.max\(2000\)/);
  });

  it("action memakai clampGoalForUnit + isoWeekStart + upsert per minggu", () => {
    const body = actions.slice(
      actions.indexOf("export async function setWeeklyGoal"),
      actions.indexOf("// ---------- Profile"),
    );
    expect(body).toMatch(/clampGoalForUnit\(parsed\.data\.unit, parsed\.data\.value\)/);
    expect(body).toMatch(/isoWeekStart\(new Date\(\)\)/);
    expect(body).toMatch(/from\("weekly_plans"\)/);
    expect(body).toMatch(/onConflict: "enrollment_id,week_start"/);
    // RLS student membatasi ke enrollment aktif milik murid → baris asing kosong.
    expect(body).toMatch(/"NOT_FOUND_OR_FORBIDDEN"/);
  });
});

describe("lib — menit dari study_sessions + rollup unit-aware", () => {
  it("weeklyActiveMinutes dari baris sesi (clamp per sesi, filter minggu)", () => {
    expect(lib).toMatch(/export function weeklyActiveMinutes/);
    expect(lib).toMatch(/clampSessionActiveSeconds\(s\.active_seconds\)/);
    expect(lib).toMatch(/isSameIsoWeek\(new Date\(s\.started_at\), weekStart, tz\)/);
  });
  it("clampGoalForUnit & weeklyRollupForUnit & default menit", () => {
    expect(lib).toMatch(/export function clampGoalForUnit/);
    expect(lib).toMatch(/export function weeklyRollupForUnit/);
    expect(lib).toMatch(/DEFAULT_WEEKLY_GOAL_MINUTES = 120/);
    expect(lib).toMatch(/WEEKLY_GOAL_MAX_MINUTES = 2000/);
    expect(lib).toMatch(/export function formatActiveMinutes/);
  });
  it("konstanta gap sesi & clamp sesi di active-time", () => {
    expect(activeTime).toMatch(/SESSION_CONTINUATION_GAP_MS = 10 \* 60_000/);
    expect(activeTime).toMatch(/MAX_SESSION_ACTIVE_SECONDS = 21_600/);
    expect(activeTime).toMatch(/export function isSessionContinuation/);
    expect(activeTime).toMatch(/export function clampSessionActiveSeconds/);
  });
});
