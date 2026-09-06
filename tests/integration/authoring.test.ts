import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Prompt 03: RLS authoring — kelola hanya pemilik, baca hanya published+enrollment. */
const init = readFileSync("supabase/migrations/20260906000000_init.sql", "utf8");
const hard = readFileSync("supabase/migrations/20260906000002_phase1_hardening.sql", "utf8");
const all = init + "\n" + hard;

describe("authoring write = teacher-owner (USING + WITH CHECK)", () => {
  it("courses for all mencakup insert/update/delete dengan owner check", () => {
    expect(all).toMatch(/courses_teacher_all on public\.courses for all[\s\S]*?owner_id = auth\.uid\(\)/);
  });
  it("teacher_rw content-tree selalu USING + WITH CHECK", () => {
    const rw = [...hard.matchAll(/create policy (\w+_teacher_rw) on public\.\w+ for all([\s\S]*?);/gi)];
    expect(rw.length).toBeGreaterThanOrEqual(8);
    for (const [, name, body] of rw) {
      expect(body, name ?? "?").toMatch(/using/i);
      expect(body, name ?? "?").toMatch(/with check/i);
    }
  });
});

describe("tidak ada edit in-place versi published (kontrak ADR-003)", () => {
  it("publish action memakai update published_at, bukan overwrite konten", () => {
    const actions = readFileSync("features/actions.ts", "utf8");
    expect(actions).toMatch(/published_at/);
  });
  it("duplicate selalu status draft versi 1", () => {
    const actions = readFileSync("features/actions.ts", "utf8");
    expect(actions).toMatch(/status: "draft"/);
    expect(actions).toMatch(/version: 1/);
  });
});

describe("no hard delete pada data berattempt (DATA_MODEL.md: attempt/revision/certificate/audit append-only)", () => {
  it("archive = update status, tanpa hard delete konten terpakai", () => {
    const actions = readFileSync("features/actions.ts", "utf8");
    expect(actions).toMatch(/status: "archived"/);
    // Satu-satunya .delete() adalah deleteContent: versi draft + subtree TANPA attempt.
    const hardDeletes = actions.match(/\.delete\(\)/g) ?? [];
    expect(hardDeletes.length).toBe(1);
    expect(actions).toMatch(/PUBLISHED_IMMUTABLE/);
    expect(actions).toMatch(/HAS_ATTEMPTS/);
    // Tidak boleh ada hard delete pada tabel append-only.
    expect(actions).not.toMatch(/from\("(attempts|grade_revisions|certificates|audit_logs)"\)\.delete/);
  });
});
