import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * AI draft feedback (Phase 4 KURANG, migration 000011; ADR-014/015/017).
 * Bukti statis — perilaku sungguhan (RLS, definer RPC, denial lintas role)
 * diuji live di scripts/live-denial (grup t11_ dan p11_).
 */
const migration = readFileSync("supabase/migrations/20260906000011_ai_feedback_consent.sql", "utf8");

describe("migration 000011 — consent + draft AI", () => {
  it("consent per-org default false + timestamp", () => {
    expect(migration).toMatch(/add column if not exists ai_feedback_consent boolean not null default false/);
    expect(migration).toMatch(/add column if not exists ai_feedback_consent_at timestamptz/);
  });

  it("tabel draft terpisah dengan status draft/approved/rejected + unique response", () => {
    expect(migration).toMatch(/create table public\.ai_feedback_drafts/);
    expect(migration).toMatch(/response_id uuid not null unique references public\.responses\(id\)/);
    expect(migration).toMatch(/check \(status in \('draft','approved','rejected'\)\)/);
    expect(migration).toMatch(/alter table public\.ai_feedback_drafts enable row level security/);
  });

  it("RLS: hanya policy teacher (select/insert/update USING+WITH CHECK); tanpa murid/anon; no hard delete", () => {
    expect(migration).toMatch(/ai_drafts_teacher_select/);
    expect(migration).toMatch(/ai_drafts_teacher_insert/);
    expect(migration).toMatch(/ai_drafts_teacher_update/);
    expect(migration).toMatch(/with check \(exists/);
    // Tidak ada policy untuk anon dan tidak ada policy delete.
    expect(migration).not.toMatch(/ to anon /);
    expect(migration).not.toMatch(/for delete to/);
    expect(migration).toMatch(/create rule no_delete_ai_drafts/);
  });

  it("RPC definer + search_path + revoke PUBLIC + grant authenticated", () => {
    for (const fn of ["set_org_ai_consent", "upsert_ai_draft", "apply_ai_feedback"]) {
      expect(migration).toMatch(new RegExp(`create or replace function private\\.${fn}`));
    }
    expect(migration).toMatch(/language plpgsql security definer/);
    expect(migration).toMatch(/set search_path = private, public, pg_temp/);
    expect(migration).toMatch(
      /revoke all on function public\.set_org_ai_consent\(uuid, boolean\) from public/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.upsert_ai_draft\(uuid, text, text\) from public/,
    );
    expect(migration).toMatch(/revoke all on function public\.apply_ai_feedback\(uuid, text\) from public/);
    expect(migration).toMatch(
      /grant execute on function public\.set_org_ai_consent\(uuid, boolean\) to authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.upsert_ai_draft\(uuid, text, text\) to authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.apply_ai_feedback\(uuid, text\) to authenticated/,
    );
  });

  it("apply hanya lewat approval: menulis ai_approved + grade_revisions reason, bukan body mentah", () => {
    expect(migration).toMatch(/'ai_approved'/);
    expect(migration).toMatch(/'ai_draft:approved'/);
    // Draft TIDAK pernah ditulis ke feedback_json dari upsert.
    expect(migration).not.toMatch(/feedback_json.*p_body/);
    expect(migration).toMatch(/insert into public\.grade_revisions/);
    expect(migration).toMatch(/auth\.uid\(\) is null then raise exception 'UNAUTHENTICATED'/);
    expect(migration).toMatch(/raise exception 'FORBIDDEN'/);
  });
});
