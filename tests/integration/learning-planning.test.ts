import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Learning planning (spaced review, ADR-011): hook level-completion di
 * recomputeProgress. Bukti statis — perilaku nyata (index anti-duplikat,
 * RLS) diuji live di scripts/live-denial; semantik jadwal di
 * tests/unit/progress-planning.test.ts.
 */
const actions = readFileSync("features/actions.ts", "utf8");
const lib = readFileSync("lib/progress-planning.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260906000009_learning_planning.sql", "utf8");

describe("level completion → jadwal review pertama (hook aplikasi)", () => {
  it("recomputeProgress memakai firstReviewInsertRows dari lib", () => {
    expect(actions).toMatch(/import \{ firstReviewInsertRows \} from "@\/lib\/progress-planning"/);
  });

  it("hook hanya menjadwalkan level yang selesai & belum punya baris review", () => {
    expect(actions).toMatch(/doneLevelIds = levelResults\.filter\(\(l\) => l\.done\)/);
    // Baca baris review existing per enrollment+level agar recompute ulang
    // tidak menggandakan (satu ACTIVE dijamin index parsial).
    expect(actions).toMatch(/\.from\("review_items"\)/);
    expect(actions).toMatch(/\.select\("entity_id"\)/);
    expect(actions).toMatch(/eq\("enrollment_id", enr\.id\)/);
    expect(actions).toMatch(/eq\("entity_type", "level"\)/);
    expect(actions).toMatch(/alreadyReviewed\.has\(r\.entity_id\)/);
    expect(actions).toMatch(/\.insert\(fresh\)/);
    expect(actions).toMatch(/reviewScheduled/);
  });

  it("hook tidak menghapus review (append-only) dan hasil memuat reviewScheduled", () => {
    // Scope: tubuh recomputeProgress (dari signature s/d return) tidak memuat
    // DELETE (hapus lain di file, mis. deleteContent, bukan bagian hook).
    const body = actions.slice(
      actions.indexOf("export async function recomputeProgress"),
      actions.indexOf("levels: levelResults,"),
    );
    expect(body).not.toMatch(/\.delete\(\)/);
    expect(body).toMatch(/reviewScheduled/);
  });

  it("migration menyediakan tabel + index parsial anti-duplikat scheduled", () => {
    expect(migration).toMatch(/create table public\.review_items/);
    expect(migration).toMatch(/create unique index review_items_one_active/);
    expect(migration).toMatch(/where status = 'scheduled'/);
    expect(migration).toMatch(/alter table public\.review_items enable row level security/);
    // status hanya maju (tanpa policy delete = no hard delete).
    expect(migration).toMatch(/'scheduled','completed','dismissed'/);
  });

  it("lib mengekspor pembuat baris review pertama", () => {
    expect(lib).toMatch(/export function firstReviewInsertRows/);
    expect(lib).toMatch(/DEFAULT_REVIEW_INTERVALS_DAYS/);
  });
});
