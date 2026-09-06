import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260906000001_storage.sql", "utf8");

describe("private storage buckets", () => {
  it("buckets submissions & certificates private", () => {
    expect(sql).toMatch(/'submissions', 'submissions', false/);
    expect(sql).toMatch(/'certificates', 'certificates', false/);
  });
  it("denial test 8: upload terkunci per-folder uid (foldername + auth.uid)", () => {
    expect(sql).toMatch(/submissions_student_insert[\s\S]*?storage\.foldername\(name\)/);
    expect(sql).toMatch(/auth\.uid\(\)/);
  });
  it("certificates: tidak ada INSERT/UPDATE untuk authenticated (server-only via service key)", () => {
    expect(sql).not.toMatch(/certificates.*for insert to authenticated/i);
    expect(sql).not.toMatch(/certificates.*for update to authenticated/i);
  });
  it("UPDATE policy storage punya USING + WITH CHECK", () => {
    const updates = [...sql.matchAll(/for update([\s\S]*?);/gi)];
    for (const [, body] of updates) {
      expect(body).toMatch(/using/i);
      expect(body).toMatch(/with check/i);
    }
  });
});
