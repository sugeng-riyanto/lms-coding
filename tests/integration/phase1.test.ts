import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Prompt 02 — Phase 1 tambahan: audit trigger, wali tertaut, guards kontrak,
 * answer-key protection, dan "TO authenticated tidak pernah sendirian".
 */
const init = readFileSync("supabase/migrations/20260906000000_init.sql", "utf8");
const hard = readFileSync("supabase/migrations/20260906000002_phase1_hardening.sql", "utf8");
const all = init + "\n" + hard;

describe("audit role/membership append-only", () => {
  it("trigger memberships + profiles terdaftar", () => {
    expect(hard).toMatch(/trg_memberships_audit/);
    expect(hard).toMatch(/trg_profiles_audit/);
    expect(hard).toMatch(/private\.audit_role_change\(\)/);
  });
  it("fungsi audit: security definer + search_path tetap + revoke PUBLIC", () => {
    expect(hard).toMatch(/audit_role_change\(\)[\s\S]*?security definer/);
    expect(hard).toMatch(/revoke all on function private\.audit_role_change\(\) from public/);
  });
  it("role tidak bisa diubah dari browser: memberships tanpa UPDATE/DELETE policy", () => {
    expect(all).not.toMatch(/on public\.memberships for update/i);
    expect(all).not.toMatch(/on public\.memberships for delete/i);
    expect(all).not.toMatch(/on public\.memberships for insert/i);
  });
});

describe("wali: hanya anak tertaut-aktif", () => {
  it("semua policy guardian mensyaratkan status='active'", () => {
    const g = [...hard.matchAll(/create policy \w*guardian\w* on public\.\w+ for select([\s\S]*?);/gi)];
    expect(g.length).toBeGreaterThanOrEqual(3);
    for (const [, body] of g) {
      expect(body).toMatch(/status = 'active'/);
    }
  });
  it("wali tidak dapat INSERT/UPDATE/DELETE guardian_links", () => {
    expect(all).not.toMatch(/on public\.guardian_links for (insert|update|delete)/i);
  });
});

describe("guru lintas organisasi/cohort ditolak", () => {
  it("teacher_cohort_ids hanya cohort yang diajar sendiri", () => {
    expect(init).toMatch(/c\.teacher_id = auth\.uid\(\)/);
  });
  it("content teacher selalu join owner_id = auth.uid()", () => {
    const teacherPolicies = [...hard.matchAll(/_teacher_rw on public\.\w+ for all([\s\S]*?);/gi)];
    expect(teacherPolicies.length).toBeGreaterThan(5);
    for (const [, body] of teacherPolicies) {
      expect(body).toMatch(/owner_id = auth\.uid\(\)|is_teacher_of|m\.role = 'teacher'/);
    }
  });
});

describe("murid: baca published + enrollment aktif saja", () => {
  it("setiap student_published mensyaratkan published_at + enrollment aktif", () => {
    const pubs = [...hard.matchAll(/_student_published on public\.\w+ for select([\s\S]*?);/gi)];
    expect(pubs.length).toBeGreaterThanOrEqual(6);
    for (const [, body] of pubs) {
      expect(body).toMatch(/published_at is not null/);
      expect(body).toMatch(/status = 'active'/);
    }
  });
});

describe("answer key tidak bocor via RLS", () => {
  it("questions/question_versions: TANPA policy student", () => {
    expect(all).not.toMatch(/on public\.questions for select to authenticated\s*\n?\s*using \([^)]*student/i);
    expect(all).not.toMatch(/questions_student/i);
    expect(all).not.toMatch(/qversions_student/i);
  });
  it("guru pengelola dibatasi org sendiri (is_teacher_of)", () => {
    expect(hard).toMatch(/questions_teacher_rw[\s\S]*?is_teacher_of/);
  });
});

describe("TO authenticated tidak pernah sendirian", () => {
  it("setiap policy authenticated punya ownership/relationship predicate", () => {
    const policies = [...all.matchAll(/create policy (\w+) on ([\w.]+) for (\w+)([\s\S]*?);/gi)];
    expect(policies.length).toBeGreaterThan(20);
    for (const m of policies) {
      const name = m[1] ?? "?";
      const body = m[4] ?? "";
      const hasPredicate =
        /auth\.uid\(\)|teacher_cohort_ids|is_teacher_of|status = 'active'|published_at|and false/i.test(body);
      expect(hasPredicate, name).toBe(true);
    }
  });
});

describe("jobs & chain_anchors terkunci service-only", () => {
  it("tidak ada policy authenticated pada jobs/chain_anchors", () => {
    expect(all).not.toMatch(/on public\.jobs for \w+ to authenticated/i);
    expect(all).not.toMatch(/on public\.chain_anchors for \w+ to authenticated/i);
  });
});
