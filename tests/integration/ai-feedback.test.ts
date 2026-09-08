import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * AI draft feedback (Phase 4 KURANG, migration 000011; ADR-014/015/017).
 * Bukti statis — perilaku sungguhan (RLS, definer RPC, denial lintas role)
 * diuji live di scripts/live-denial (grup t11_ dan p11_).
 */
const migration = readFileSync("supabase/migrations/20260906000011_ai_feedback_consent.sql", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const lib = readFileSync("lib/ai-feedback.ts", "utf8");
const actions = readFileSync("features/actions.ts", "utf8");
const queue = readFileSync("app/(teacher)/teacher/grading/grade-queue.tsx", "utf8");

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

  it("migration 000001 replaces RULE with trigger-based guard (cascade-safe)", () => {
    const fix = readFileSync("supabase/migrations/20260909000001_ai_draft_cascade_fix.sql", "utf8");
    // Old rule must be dropped
    expect(fix).toMatch(/drop rule if exists no_delete_ai_drafts/);
    // New trigger function in private schema
    expect(fix).toMatch(/create or replace function private\.block_direct_ai_draft_delete/);
    expect(fix).toMatch(/security definer/);
    expect(fix).toMatch(/set search_path = private, public, pg_temp/);
    // pg_trigger_depth() gate: 0 = direct (block), >0 = cascade (allow)
    expect(fix).toMatch(/pg_trigger_depth\(\)/);
    // Trigger attached
    expect(fix).toMatch(/create trigger guard_ai_draft_delete/);
    expect(fix).toMatch(/before delete on public\.ai_feedback_drafts/);
    expect(fix).toMatch(/for each row/);
    expect(fix).toMatch(/execute function private\.block_direct_ai_draft_delete/);
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

describe("slice AI — env, lib, actions, UI (AC-1/6/7/9)", () => {
  it(".env.example memuat 4 key AI server-only, tanpa NEXT_PUBLIC_AI_", () => {
    expect(envExample).toMatch(/AI_FEEDBACK_ENABLED=false/);
    expect(envExample).toMatch(/^AI_PROVIDER=$/m);
    expect(envExample).toMatch(/^AI_PROVIDER_BASE_URL=$/m);
    expect(envExample).toMatch(/^AI_PROVIDER_API_KEY=$/m);
    expect(envExample).not.toMatch(/NEXT_PUBLIC_AI_/);
  });

  it("lib/ai-feedback.ts: buildPrompt/extractAnswerText/provider mock+http/null + label", () => {
    expect(lib).toMatch(/export interface AiDraftProvider/);
    expect(lib).toMatch(/export function buildPrompt/);
    expect(lib).toMatch(/export function extractAnswerText/);
    expect(lib).toMatch(/export const AI_DRAFT_LABEL/);
    expect(lib).toMatch(/export function createAiProvider/);
    expect(lib).toMatch(/kind: "mock"/);
    expect(lib).toMatch(/kind: "http"/);
    expect(lib).toMatch(/return null;/); // unconfigured
    expect(lib).toMatch(/AbortController/); // timeout 10s
  });

  it("actions: request/approve/reject + urutan consent→provider→draft; provider server-only", () => {
    expect(actions).toMatch(/export async function requestAiDraft/);
    expect(actions).toMatch(/export async function approveAiDraft/);
    expect(actions).toMatch(/export async function rejectAiDraft/);
    // Urutan gerbang: env → provider → consent → draft (fail closed).
    const fn = actions.slice(actions.indexOf("export async function requestAiDraft"));
    const gate = fn.indexOf("AI_FEEDBACK_ENABLED");
    const provider = fn.indexOf("createAiProvider");
    const consent = fn.indexOf("AI_NO_CONSENT");
    const draft = fn.indexOf("upsert_ai_draft");
    expect(gate).toBeGreaterThan(-1);
    expect(provider).toBeGreaterThan(gate);
    expect(consent).toBeGreaterThan(provider);
    expect(draft).toBeGreaterThan(consent);
    // Approval menulis feedback final via RPC (audit) — bukan body mentah.
    expect(actions).toMatch(/apply_ai_feedback/);
    expect(actions).toMatch(/ai_draft:approved/);
    expect(actions).toMatch(/from "@\/lib\/ai-feedback"/);
    expect(actions).toMatch(/getServerEnv\(\)/);
  });

  it("UI queue: tombol draft + panel label jelas + Setujui/Tolak; tanpa import lib AI di client", () => {
    expect(queue).toMatch(/"use client"/);
    // Label tombol kini bilingual via dictionary lib/ui-text/grading (GRADING).
    expect(queue).toMatch(/GRADING/);
    expect(queue).toMatch(/requestAiDraft/);
    expect(queue).toMatch(/approveAiDraft/);
    expect(queue).toMatch(/rejectAiDraft/);
    // AC-6: provider lib TIDAK diimpor dari file client.
    expect(queue).not.toMatch(/@\/lib\/ai-feedback/);
  });
});
