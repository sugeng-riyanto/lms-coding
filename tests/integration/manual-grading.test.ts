import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Manual grading reaches attempts.final_score (migration 000002).
 *
 * Static evidence that:
 * 1. private.recompute_attempt_score exists, recomputes raw/final from
 *    responses with questionScore semantics (min(auto+manual, points)),
 *    and honors the randomized-pool subset (question_order_json.order).
 * 2. grade_response_manual calls the recompute after storing manual_score.
 * 3. finalize_response_grades stores manual_score in QUESTION POINTS
 *    (pct% × question_versions.points — coherent with auto_score), keeps
 *    the DRAFT_INCOMPLETE / EMPTY_RUBRIC / NO_RUBRIC guards, and also
 *    calls the recompute.
 * 4. Public wrappers + grants remain intact.
 */
const fixMigration = readFileSync("supabase/migrations/20260909000002_attempt_score_recompute.sql", "utf8");

describe("attempt-score recompute after manual grading", () => {
  it("creates private.recompute_attempt_score with security-definer posture", () => {
    expect(fixMigration).toMatch(/create or replace function private\.recompute_attempt_score\(p_attempt_id uuid\)/);
    expect(fixMigration).toMatch(/returns numeric/);
    expect(fixMigration).toMatch(/security definer/);
    expect(fixMigration).toMatch(/set search_path = private, public, pg_temp/);
    expect(fixMigration).toMatch(/revoke all on function private\.recompute_attempt_score\(uuid\) from public/);
  });

  it("recompute uses questionScore semantics: min(auto + manual, points), floor 0", () => {
    // lib/grading.ts questionScore: Math.min(Math.max(auto + (manual ?? 0), 0), points)
    expect(fixMigration).toMatch(/greatest\(0, least\(v_qp, coalesce\(v_resp\.auto_score, 0\) \+ coalesce\(v_resp\.manual_score, 0\)\)\)/);
  });

  it("recompute honors the randomized-pool subset from question_order_json", () => {
    expect(fixMigration).toMatch(/question_order_json -> 'order'/);
    expect(fixMigration).toMatch(/jsonb_array_elements_text\(v_attempt\.question_order_json -> 'order'\)/);
    expect(fixMigration).toMatch(/v_order_ids is null or aq\.question_version_id = any \(v_order_ids\)/);
  });

  it("recompute updates attempts raw_score and final_score", () => {
    expect(fixMigration).toMatch(/set raw_score = v_percent, final_score = v_percent, updated_at = now\(\)/);
  });

  it("grade_response_manual keeps its guards and calls recompute", () => {
    const fn = fixMigration.match(/create or replace function private\.grade_response_manual[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(fn).toMatch(/raise exception 'UNAUTHENTICATED'/);
    expect(fn).toMatch(/raise exception 'FORBIDDEN'/);
    expect(fn).toMatch(/raise exception 'INVALID_SCORE'/);
    expect(fn).toMatch(/insert into public\.grade_revisions \(attempt_id, previous_score, new_score, reason, changed_by\)/);
    expect(fn).toMatch(/perform private\.recompute_attempt_score\(v_attempt\)/);
  });

  it("finalize_response_grades stores manual_score in POINTS (not percent) and calls recompute", () => {
    const fn = fixMigration.match(/create or replace function private\.finalize_response_grades[\s\S]*?\$\$;/)?.[0] ?? "";
    // pct% of question points → manual in points, coherent with auto_score.
    expect(fn).toMatch(/v_manual_points := round\(\(v_pct \/ 100\) \* coalesce\(v_qv_points, 0\), 2\)/);
    expect(fn).toMatch(/update public\.responses set manual_score = v_manual_points/);
    expect(fn).toMatch(/perform private\.recompute_attempt_score\(v_attempt\)/);
  });

  it("finalize keeps rubric guards intact", () => {
    const fn = fixMigration.match(/create or replace function private\.finalize_response_grades[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(fn).toMatch(/raise exception 'NO_RUBRIC'/);
    expect(fn).toMatch(/raise exception 'DRAFT_INCOMPLETE'/);
    expect(fn).toMatch(/raise exception 'EMPTY_RUBRIC'/);
    expect(fn).toMatch(/'rubric finalized'/);
  });

  it("public wrappers and grants are recreated", () => {
    expect(fixMigration).toMatch(/create or replace function public\.grade_response_manual\(p_response_id uuid, p_manual_score numeric, p_feedback text\)/);
    expect(fixMigration).toMatch(/create or replace function public\.finalize_response_grades\(p_response_id uuid\)/);
    expect(fixMigration).toMatch(/grant execute on function public\.grade_response_manual\(uuid, numeric, text\) to authenticated/);
    expect(fixMigration).toMatch(/grant execute on function public\.finalize_response_grades\(uuid\) to authenticated/);
  });
});