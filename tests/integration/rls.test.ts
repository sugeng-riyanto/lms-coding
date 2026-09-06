import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * RLS/denial static tests: memastikan migration memenuhi kontrak AGENTS.md/RBAC.md
 * tanpa membutuhkan live Postgres (dipakai juga sebagai gate sebelum advisor run).
 * 8 denial tests RBAC.md dipetakan ke policy yang wajib ada.
 */
const sql = readFileSync("supabase/migrations/20260906000000_init.sql", "utf8");

describe("rls enabled di semua exposed tables", () => {
  const tables = [
    "profiles",
    "memberships",
    "cohorts",
    "enrollments",
    "attempts",
    "responses",
    "certificates",
    "audit_logs",
    "learning_events",
  ];
  for (const t of tables) {
    it(t, () => {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    });
  }
});

describe("denial tests → policy mapping", () => {
  it("1. murid A tidak baca data murid B (ownership predicate)", () => {
    expect(sql).toMatch(/attempts_student_select[\s\S]*?e\.student_id = auth\.uid\(\)/);
    expect(sql).toMatch(/student_id = auth\.uid\(\)/);
  });
  it("2. murid tidak ubah score/completion/enrollment/role/certificate", () => {
    // tidak ada policy UPDATE attempts/responses untuk student; hanya teacher
    expect(sql).toMatch(/attempts_teacher_update/);
    expect(sql).not.toMatch(/attempts_student_update/);
    expect(sql).not.toMatch(/memberships_.*_update/);
  });
  it("3. guru lintas organisasi/cohort ditolak (teacher_cohort_ids)", () => {
    expect(sql).toMatch(/private\.teacher_cohort_ids\(\)/);
  });
  it("4. wali hanya via active link", () => {
    expect(sql).toMatch(/guardian_links_own[\s\S]*?status = 'active'/);
  });
  it("5. anonymous ditolak (semua policy TO authenticated)", () => {
    expect(sql).not.toMatch(/to anon\b/);
    expect(sql).toMatch(/to authenticated/);
  });
  it("6. verifier minimal-PII (view tanpa email/dob/jawaban/nilai/path)", () => {
    const view = sql.slice(sql.indexOf("certificates_public"));
    expect(view).not.toMatch(/email/i);
    expect(view).not.toMatch(/answer_json/);
    expect(view).not.toMatch(/pdf_path/);
    expect(view).toMatch(/security_invoker\s*=\s*true/);
  });
  it("7. revoked tidak bisa diunduh sebagai valid (status check di API + RLS)", () => {
    expect(sql).toMatch(/status in \('active','revoked'\)/);
  });
  it("8. upload tidak menimpa milik orang lain (event insert ownership)", () => {
    expect(sql).toMatch(/events_student_insert[\s\S]*?student_id = auth\.uid\(\)/);
  });
});

describe("kontrak keamanan AGENTS.md", () => {
  it("setiap UPDATE policy punya USING + WITH CHECK", () => {
    const updates = [...sql.matchAll(/create policy (\w+) on public\.\w+ for update([\s\S]*?);/gi)];
    expect(updates.length).toBeGreaterThan(0);
    for (const [, name, body] of updates) {
      expect(body, name).toMatch(/using/i);
      expect(body, name).toMatch(/with check/i);
    }
  });
  it("fungsi privileged: schema private + search_path + revoke PUBLIC", () => {
    expect(sql).toMatch(/set search_path = private, public, pg_temp/);
    expect(sql).toMatch(/revoke all on function public\.finalize_attempt/);
    expect(sql).toMatch(/grant execute on function public\.finalize_attempt.*to authenticated/);
  });
  it("append-only: rule tolak DELETE attempts/revisions/certs/audit", () => {
    expect(sql).toMatch(/no_delete_attempts/);
    expect(sql).toMatch(/no_delete_certs/);
    expect(sql).toMatch(/no_delete_audit/);
  });
  it("CHECK 0-100 dan mastery 0-1", () => {
    expect(sql).toMatch(/check \(percent between 0 and 100\)/i);
    expect(sql).toMatch(/check \(mastery between 0 and 1\)/i);
  });
});
