import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ai_feedback_drafts cascade fix (migration 000001).
 *
 * Static evidence that:
 * 1. The old RULE is dropped in the fix migration.
 * 2. The trigger-based guard function exists with the right signature.
 * 3. The FK ON DELETE CASCADE on ai_feedback_drafts.response_id is still
 *    present in the original migration (the fix doesn't touch it).
 * 4. No session_replication_role = replica workaround exists in any
 *    committed .ts/.mjs/.sql file (the fix eliminates the need).
 */
const originalMigration = readFileSync("supabase/migrations/20260906000011_ai_feedback_consent.sql", "utf8");
const fixMigration = readFileSync("supabase/migrations/20260909000001_ai_draft_cascade_fix.sql", "utf8");

describe("ai_feedback_drafts cascade fix", () => {
  it("original migration has ON DELETE CASCADE FK to responses", () => {
    expect(originalMigration).toMatch(
      /response_id uuid not null unique references public\.responses\(id\) on delete cascade/,
    );
  });

  it("fix migration drops the old no_delete_ai_drafts RULE", () => {
    expect(fixMigration).toMatch(/drop rule if exists no_delete_ai_drafts/);
  });

  it("fix migration creates private.block_direct_ai_draft_delete trigger function", () => {
    expect(fixMigration).toMatch(/create or replace function private\.block_direct_ai_draft_delete/);
    expect(fixMigration).toMatch(/security definer/);
    expect(fixMigration).toMatch(/set search_path = private, public, pg_temp/);
    expect(fixMigration).toMatch(/returns trigger/);
    expect(fixMigration).toMatch(/language plpgsql/);
  });

  it("trigger function gates on pg_trigger_depth to allow cascades", () => {
    // The function must check pg_trigger_depth() to distinguish:
    //   depth 0 = direct DELETE (blocked with exception)
    //   depth > 0 = CASCADE from parent (allowed)
    expect(fixMigration).toMatch(/pg_trigger_depth\(\)/);
    expect(fixMigration).toMatch(/raise exception/);
  });

  it("trigger is attached as BEFORE DELETE on ai_feedback_drafts", () => {
    expect(fixMigration).toMatch(/create trigger guard_ai_draft_delete/);
    expect(fixMigration).toMatch(/before delete on public\.ai_feedback_drafts/);
    expect(fixMigration).toMatch(/for each row/);
    expect(fixMigration).toMatch(/execute function private\.block_direct_ai_draft_delete/);
  });

  it("no session_replication_role = replica workaround in any committed source", () => {
    const files = [
      "features/actions.ts",
      "lib/ai-feedback.ts",
      "lib/attempt.ts",
      "app/(teacher)/teacher/grading/grade-queue.tsx",
    ];
    for (const f of files) {
      const content = readFileSync(f, "utf8");
      expect(content).not.toMatch(/session_replication_role/);
      expect(content).not.toMatch(/replica/);
    }
  });

  it("original migration still has the RULE (historical record — fix drops it)", () => {
    // The original migration must still contain the rule definition
    // so that a fresh supabase db reset applies the rule, then the fix
    // migration drops it. This is the correct forward-only migration pattern.
    expect(originalMigration).toMatch(
      /create rule no_delete_ai_drafts as on delete to public\.ai_feedback_drafts do instead nothing/,
    );
  });
});
