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
const validation = readFileSync("lib/validation.ts", "utf8");

describe("level completion → jadwal review pertama (hook aplikasi)", () => {
  it("recomputeProgress memakai firstReviewInsertRows dari lib", () => {
    expect(actions).toMatch(/import \{ firstReviewInsertRows/);
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

describe("submitReview — confidence → reschedule ladder (server action)", () => {
  it("schema submitReview + helper ladder & batas hari ini dipakai action", () => {
    expect(validation).toMatch(/export const submitReviewSchema = z\.object\(\{/);
    expect(actions).toMatch(/submitReviewSchema,/);
    expect(actions).toMatch(/nextReviewAfter\(/);
    expect(actions).toMatch(/startOfNextDayInTz\(now\)/);
  });

  it("hanya baris milik enrollment sendiri yang bisa di-review (FORBIDDEN/NOT_SCHEDULED)", () => {
    const body = actions.slice(
      actions.indexOf("export async function submitReview"),
      actions.indexOf("export async function enrollStudent"),
    );
    expect(body).toMatch(/enrollment_id !== parsed\.data\.enrollmentId/);
    expect(body).toMatch(/"FORBIDDEN"/);
    // RLS select membatasi ke enrollment aktif milik murid → baris asing kosong.
    expect(body).toMatch(/eq\("status", "scheduled"\)/);
  });

  it("menolak yang belum jatuh tempo (NOT_DUE) dan tidak menghapus review", () => {
    const body = actions.slice(
      actions.indexOf("export async function submitReview"),
      actions.indexOf("export async function enrollStudent"),
    );
    expect(body).toMatch(/"NOT_DUE"/);
    expect(body).not.toMatch(/\.delete\(\)/);
    // Transisi status: scheduled → completed + baris scheduled baru (append-only).
    expect(body).toMatch(/status: "completed"/);
    expect(body).toMatch(/completed_at: now\.toISOString\(\)/);
    expect(body).toMatch(/status: "scheduled"/);
    expect(body).toMatch(/due_at: next\.dueAt\.toISOString\(\)/);
    expect(body).toMatch(/interval_idx: next\.intervalIdx/);
  });

  it("confidence dibatasi 1–5 dan metadata heartbeat divalidasi server", () => {
    expect(validation).toMatch(/confidence: z\.number\(\)\.int\(\)\.min\(1\)\.max\(5\)/);
    // Active-time: server clamp ulang metadata heartbeat (bukan percaya client).
    expect(actions).toMatch(/validateHeartbeatMetadata\(metadata\)/);
    expect(actions).toMatch(/activeMs: v\.activeMs/);
    expect(actions).toMatch(/validateDraftMetadata\(metadata\)/);
  });
});
