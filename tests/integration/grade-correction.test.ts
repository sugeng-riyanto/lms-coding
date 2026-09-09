import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Post-release grade correction (migration 20260909055534).
 *
 * Static evidence that grade_response_manual now supports correcting an
 * already-graded (finalized) essay response with a full audit trail:
 *
 * 1. Captures v_prev = current manual_score BEFORE the update, so
 *    grade_revisions records previous→new (previous is NULL only for the
 *    very first grade, never for corrections).
 * 2. Writes audit_logs on EVERY quick grade — 'grade.manual' for the first
 *    grade, 'grade.corrected' when the stored score actually changes
 *    (post-release correction).
 * 3. Keeps the UNAUTHENTICATED / FORBIDDEN / INVALID_SCORE guards and the
 *    recompute call so the student immediately sees the latest score
 *    (attempts.final_score) — identical recompute path as first grading.
 */
const correctionMigration = readFileSync(
  "supabase/migrations/20260909055534_grade_correction_audit.sql",
  "utf8",
);

describe("post-release grade correction (old→new revision + audit)", () => {
  it("replaces private.grade_response_manual with correction-aware body", () => {
    const fn = correctionMigration.match(
      /create or replace function private\.grade_response_manual[\s\S]*?\$\$;/,
    )?.[0] ?? "";
    expect(fn).toMatch(/create or replace function private\.grade_response_manual\(p_response_id uuid, p_manual_score numeric, p_feedback text\)/);
    expect(fn).toMatch(/security definer/);
    expect(fn).toMatch(/set search_path = private, public, pg_temp/);
  });

  it("captures the previous manual score before updating", () => {
    const fn = correctionMigration.match(
      /create or replace function private\.grade_response_manual[\s\S]*?\$\$;/,
    )?.[0] ?? "";
    expect(fn).toMatch(/select r\.manual_score, ch\.organization_id into v_prev, v_org/);
    expect(fn).toMatch(/update public\.responses set manual_score = p_manual_score/);
  });

  it("records grade_revisions with previous = old score (not null) on correction", () => {
    const fn = correctionMigration.match(
      /create or replace function private\.grade_response_manual[\s\S]*?\$\$;/,
    )?.[0] ?? "";
    expect(fn).toMatch(/insert into public\.grade_revisions \(attempt_id, previous_score, new_score, reason, changed_by\)/);
    expect(fn).toMatch(/values \(v_attempt, v_prev, p_manual_score, 'manual grade', auth\.uid\(\)\)/);
  });

  it("writes audit_logs distinguishing first grade from post-release correction", () => {
    const fn = correctionMigration.match(
      /create or replace function private\.grade_response_manual[\s\S]*?\$\$;/,
    )?.[0] ?? "";
    expect(fn).toMatch(/insert into public\.audit_logs \(organization_id, actor_id, action, target_type, target_id, after_json\)/);
    expect(fn).toMatch(/'grade\.manual' else 'grade\.corrected'/);
    expect(fn).toMatch(/jsonb_build_object\('score', p_manual_score, 'previous', v_prev\)/);
  });

  it("keeps guards and recomputes the attempt score so the student sees the latest", () => {
    const fn = correctionMigration.match(
      /create or replace function private\.grade_response_manual[\s\S]*?\$\$;/,
    )?.[0] ?? "";
    expect(fn).toMatch(/raise exception 'UNAUTHENTICATED'/);
    expect(fn).toMatch(/raise exception 'FORBIDDEN'/);
    expect(fn).toMatch(/raise exception 'INVALID_SCORE'/);
    expect(fn).toMatch(/perform private\.recompute_attempt_score\(v_attempt\)/);
  });

  it("does not re-create public wrappers (unchanged from 000002) to avoid grant churn", () => {
    // The correction migration only replaces the private body; public wrappers
    // and grants from 20260909000002 stay as-is.
    expect(correctionMigration).not.toMatch(/create or replace function public\.grade_response_manual/);
  });
});