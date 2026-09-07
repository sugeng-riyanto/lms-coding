import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCourseSchema, robloxCompletionSchema, submitAttemptSchema } from "@/lib/validation";
import { isChainEnabled, NoopChainAdapter } from "@/lib/chain";

const migration17 = readFileSync("supabase/migrations/20260906000017_chain_anchor_status.sql", "utf8");

describe("boundary validation (Zod)", () => {
  it("menolak slug jahat", () => {
    expect(createCourseSchema.safeParse({ slug: "OK BOS", title: "x" }).success).toBe(false);
    expect(createCourseSchema.safeParse({ slug: "matematika-dasar", title: "Matematika" }).success).toBe(
      true,
    );
  });
  it("submit attempt butuh idempotency key", () => {
    expect(submitAttemptSchema.safeParse({ attemptId: "not-uuid", idempotencyKey: "x" }).success).toBe(false);
  });
  it("roblox payload ditolak tanpa signature", () => {
    expect(
      robloxCompletionSchema.safeParse({
        event_id: "e",
        place_id: "p",
        roblox_user_id: "r",
        challenge_id: "d0000000-0000-0000-0000-000000000001",
        score: 90,
        issued_at: new Date().toISOString(),
        nonce: "1234567890123456",
      }).success,
    ).toBe(false);
  });
});

describe("chain adapter default OFF, tanpa klaim palsu", () => {
  it("noop saat flag off", async () => {
    process.env.BLOCKCHAIN_ANCHOR_ENABLED = "false";
    expect(isChainEnabled()).toBe(false);
    const r = await new NoopChainAdapter().anchor("abc");
    expect(r.status).toBe("not_configured");
  });
});

describe("migration 000017 — status anchor + verifier publik", () => {
  it("status CHECK pending/final/failed dan read publik non-PII", () => {
    expect(migration17).toMatch(/check \(status in \('pending', 'final', 'failed'\)\)/);
    expect(migration17).toMatch(/chain_anchors_public_read/);
    expect(migration17).toMatch(/for select to anon, authenticated using \(true\)/);
    // Hanya hash/root + tx reference yang terekspos (tanpa PII/nilai).
    expect(migration17).toMatch(/merkle_root \+ transaction_ref/);
  });

  it("view certificates_public memuat chain_anchor_status via LEFT JOIN", () => {
    expect(migration17).toMatch(/ca\.status as chain_anchor_status/);
    expect(migration17).toMatch(/left join public\.chain_anchors ca on ca\.id = c\.chain_anchor_id/);
  });
});

describe("migration 000019 — verifier RPC publik (minimal PII)", () => {
  const m19 = readFileSync("supabase/migrations/20260906000019_public_verifier_rpc.sql", "utf8");

  it("fungsi security definer + search_path + revoke PUBLIC + grant anon/authenticated", () => {
    expect(m19).toMatch(/create or replace function public\.get_public_certificate\(p_public_id text\)/);
    expect(m19).toMatch(/security definer set search_path = private, public, pg_temp/);
    expect(m19).toMatch(/revoke all on function public\.get_public_certificate\(text\) from public/);
    expect(m19).toMatch(
      /grant execute on function public\.get_public_certificate\(text\) to anon, authenticated/,
    );
  });

  it("mengembalikan PERSIS kolom whitelist — tanpa email/jawaban/nilai/path", () => {
    // jsonb_build_object hanya memuat kolom minimal (nama tampilan, judul, tanggal,
    // serial, hash payload, status anchor) — dan tidak ada email/answer/nilai/pdf_path.
    const build = m19.slice(m19.indexOf("jsonb_build_object"));
    expect(build).toMatch(/displayName/);
    expect(build).toMatch(/courseTitle/);
    expect(build).toMatch(/levelTitle/);
    expect(build).toMatch(/payloadHash/);
    expect(build).toMatch(/chainAnchorStatus/);
    expect(build).not.toMatch(/email/i);
    expect(build).not.toMatch(/answer_json|grading_json/);
    expect(build).not.toMatch(/pdf_path|qr_path/);
    expect(build).not.toMatch(/score|nilai/i);
  });

  it("validasi format public_id sebelum query + view mentah tetap terkunci anon", () => {
    expect(m19).toMatch(/!~ '\^\[a-z0-9-\]\+\$'/);
    // Komentar migrasi menegaskan view certificates_public TETAP security_invoker
    // (anon 0 baris) — hanya RPC yang jadi permukaan publik.
    expect(m19).toMatch(/TETAP security_invoker/);
  });

  it("route verifier memakai RPC (bukan query view langsung)", () => {
    const route = readFileSync("app/api/public/certificates/[publicId]/route.ts", "utf8");
    expect(route).toMatch(/rpc\("get_public_certificate"/);
    expect(route).toMatch(/chainAnchor\s*:\s*\{\s*status: anchorStatus/);
    expect(route).toMatch(/checkRateLimit/);
  });
});

describe("migration 000020 — index FK join-chain RLS (non-semantik, hanya performa)", () => {
  const m20 = readFileSync("supabase/migrations/20260906000020_rls_join_indexes.sql", "utf8");

  it("index idempoten pada seluruh FK join-chain content-tree + enrollment/cohort/assessment", () => {
    for (const idx of [
      "course_versions_course_id_idx",
      "levels_course_version_id_idx",
      "modules_level_id_idx",
      "lessons_module_id_idx",
      "activities_lesson_id_idx",
      "assessments_activity_id_idx",
      "enrollments_course_id_idx",
      "enrollments_student_id_idx",
      "enrollments_cohort_id_idx",
      "cohort_members_cohort_id_idx",
      "memberships_user_id_idx",
      "attempts_assessment_id_idx",
      "responses_attempt_id_idx",
      "question_versions_question_id_idx",
    ]) {
      expect(m20).toContain(idx);
    }
    expect(m20).toMatch(/create index if not exists/g);
  });

  it("tanpa perubahan policy/DDL semantik (hanya CREATE INDEX)", () => {
    expect(m20).not.toMatch(/create policy/i);
    expect(m20).not.toMatch(/alter table .* enable row level security/i);
  });
});

describe("migration 000021/000022 — helper policy security-definer FK-keyed", () => {
  const m22 = readFileSync("supabase/migrations/20260906000022_rls_policy_helpers_fk_keyed.sql", "utf8");

  it("helper di-key kolom FK (bukan id baris) agar WITH CHECK lolos saat INSERT", () => {
    expect(m22).toMatch(/private\.cv_owned_by_teacher\(p_course_id uuid\)/);
    expect(m22).toMatch(/private\.level_owned_by_teacher\(p_course_version_id uuid\)/);
    expect(m22).toMatch(/private\.module_owned_by_teacher\(p_level_id uuid\)/);
    expect(m22).toMatch(/private\.lesson_owned_by_teacher\(p_module_id uuid\)/);
    expect(m22).toMatch(/private\.activity_owned_by_teacher\(p_lesson_id uuid\)/);
    expect(m22).toMatch(/private\.assessment_owned_by_teacher\(p_activity_id uuid\)/);
    expect(m22).toMatch(/private\.asmtq_owned_by_teacher\(p_assessment_id uuid\)/);
  });

  it("policy memakai kolom FK pada USING dan WITH CHECK", () => {
    expect(m22).toMatch(/private\.cv_owned_by_teacher\(course_id\)/);
    expect(m22).toMatch(/private\.level_owned_by_teacher\(course_version_id\)/);
    expect(m22).toMatch(/private\.module_owned_by_teacher\(level_id\)/);
    expect(m22).toMatch(/private\.lesson_owned_by_teacher\(module_id\)/);
    expect(m22).toMatch(/private\.activity_owned_by_teacher\(lesson_id\)/);
    expect(m22).toMatch(/private\.assessment_owned_by_teacher\(activity_id\)/);
    expect(m22).toMatch(/private\.asmtq_owned_by_teacher\(assessment_id\)/);
  });

  it("helper security definer + search_path di-pin + revoke PUBLIC + grant authenticated", () => {
    expect(m22).toMatch(/security definer set search_path = private, public, pg_temp/);
    expect(m22).toMatch(/revoke all on function private\.lesson_owned_by_teacher\(uuid\) from public/);
    expect(m22).toMatch(
      /grant execute on function private\.lesson_owned_by_teacher\(uuid\) to authenticated/,
    );
    expect(m22).toMatch(/revoke all on function private\.asmtq_owned_by_teacher\(uuid\) from public/);
    expect(m22).toMatch(/grant execute on function private\.asmtq_owned_by_teacher\(uuid\) to authenticated/);
  });
});

describe("migration 000023 — RPC soal attempt tersanitasi (murid pemilik, in_progress)", () => {
  const m23 = readFileSync("supabase/migrations/20260906000023_attempt_questions_rpc.sql", "utf8");
  const actions = readFileSync("features/actions.ts", "utf8");

  it("private definer + search_path di-pin + wrapper publik + revoke PUBLIC + grant authenticated", () => {
    expect(m23).toMatch(/create or replace function private\.get_attempt_questions\(p_attempt_id uuid\)/);
    expect(m23).toMatch(/create or replace function public\.get_attempt_questions\(p_attempt_id uuid\)/);
    expect(m23).toMatch(/security definer set search_path = private, public, pg_temp/);
    expect(m23).toMatch(/revoke all on function public\.get_attempt_questions\(uuid\) from public/);
    expect(m23).toMatch(/grant execute on function public\.get_attempt_questions\(uuid\) to authenticated/);
  });

  it("return type whitelist: tanpa grading_json/explanation/answer", () => {
    const ret = m23.slice(m23.indexOf("returns table("));
    expect(ret).toMatch(/prompt_json/);
    expect(ret).not.toMatch(/grading_json/);
    expect(ret).not.toMatch(/explanation/);
    expect(ret).not.toMatch(/answer/);
  });

  it("caller check: attempt milik murid (enrollment student = auth.uid) + in_progress", () => {
    expect(m23).toMatch(/e\.student_id = auth\.uid\(\)/);
    expect(m23).toMatch(/a\.status = 'in_progress'/);
  });

  it("action memakai RPC (bukan baca tabel soal via RLS murid)", () => {
    const fn = actions.slice(
      actions.indexOf("export async function getAttemptQuestions"),
      actions.indexOf("export async function releaseGrades"),
    );
    expect(fn).toMatch(/rpc\("get_attempt_questions"/);
    expect(fn).not.toMatch(/from\("question_versions"\)/);
    expect(fn).not.toMatch(/from\("questions"\)/);
  });
});

describe("migration 20260907123000 — digital record publik (payload hash + kelengkapan per modul)", () => {
  const m = readFileSync("supabase/migrations/20260907123000_public_certificate_record_rpc.sql", "utf8");
  const route = readFileSync("app/api/public/certificates/[publicId]/record/route.ts", "utf8");

  it("fungsi security definer + search_path + revoke PUBLIC + grant anon/authenticated", () => {
    expect(m).toMatch(/create or replace function public\.get_public_certificate_record\(p_public_id text\)/);
    expect(m).toMatch(/security definer set search_path = private, public, pg_temp/);
    expect(m).toMatch(/revoke all on function public\.get_public_certificate_record\(text\) from public/);
    expect(m).toMatch(
      /grant execute on function public\.get_public_certificate_record\(text\) to anon, authenticated/,
    );
  });

  it("whitelist: payloadHash penuh + contentPercent + modules, tanpa PII/nilai/path", () => {
    expect(m).toMatch(/payloadHash/);
    expect(m).toMatch(/contentPercent/);
    expect(m).toMatch(/'modules'/);
    expect(m).toMatch(/lessonsCompleted/);
    expect(m).toMatch(/lessonsTotal/);
    expect(m).toMatch(/activitiesCompleted/);
    expect(m).toMatch(/activitiesTotal/);
    // Scope ke badan fungsi (setelah komentar header) untuk cek negatif.
    const build = m.slice(m.indexOf("jsonb_build_object"));
    expect(build).not.toMatch(/email/i);
    expect(build).not.toMatch(/answer_json|grading_json/);
    expect(build).not.toMatch(/pdf_path|qr_path/);
    expect(build).not.toMatch(/score|nilai|study_time|active_seconds/i);
  });

  it("validasi format public_id + status revoked hanya issuedAt", () => {
    expect(m).toMatch(/!~ '\^\[a-z0-9-\]\+\$'/);
    expect(m).toMatch(/'revoked', 'issuedAt', v_issued/);
  });

  it("route record: RPC kurasi + force-dynamic + rate limit, envelope tanpa PII", () => {
    expect(route).toMatch(/rpc\("get_public_certificate_record"/);
    expect(route).toMatch(/export const dynamic = "force-dynamic"/);
    expect(route).toMatch(/checkRateLimit/);
    expect(route).toMatch(/certificate\.digital-record\/v1/);
    expect(route).toMatch(/authenticity:/);
    expect(route).toMatch(/completeness:/);
    expect(route).toMatch(/payloadHash/);
    expect(route).toMatch(/modules/);
    // Scope ke kode (setelah komentar header) untuk cek negatif.
    const code = route.slice(route.indexOf("export const dynamic"));
    expect(code).not.toMatch(/email/i);
    expect(code).not.toMatch(/answer_json|grading_json/);
    expect(code).not.toMatch(/pdf_path|qr_path/);
    expect(code).not.toMatch(/final_score|raw_score/);
  });
});
