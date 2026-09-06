import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Reissue sertifikat (Phase 6, migration 000010 + action + UI teacher).
 * Bukti statis: perilaku sebenarnya (index partial, transaksi revoke+issue,
 * audit, denial lintas org) diuji live di scripts/live-denial; semantik
 * eligibility di lib (checkEligibility) + tests/unit. Di sini: urutan
 * eligibility-SEBELUM-revoke di action (ADR-013) dan pengaman migration.
 */
const actions = readFileSync("features/actions.ts", "utf8");
const validation = readFileSync("lib/validation.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260906000010_certificate_reissue.sql", "utf8");
const page = readFileSync("app/(teacher)/teacher/students/[studentId]/page.tsx", "utf8");
const button = readFileSync("app/(teacher)/teacher/students/[studentId]/reissue-button.tsx", "utf8");

describe("reissueCertificate action (ADR-013: eligibility penuh sebelum revoke)", () => {
  it("validasi schema: certificateId + reason wajib (mirror revoke)", () => {
    expect(validation).toMatch(/reissueCertificateSchema = z\.object\(\{/);
    expect(validation).toMatch(/certificateId: uuidSchema,/);
    expect(validation).toMatch(/reason: z\.string\(\)\.min\(5\)\.max\(2000\)/);
  });

  it("action memuat sertifikat via strict client lalu menolak non-active", () => {
    expect(actions).toMatch(/export async function reissueCertificate/);
    expect(actions).toMatch(/\.from\("certificates"\)/);
    expect(actions).toMatch(/\.select\("id,status,enrollment_id,level_id"\)/);
    expect(actions).toMatch(
      /if \(row\.status !== "active"\) return \{ ok: false as const, error: "NOT_ACTIVE" \};/,
    );
  });

  it("eligibility dievaluasi ulang SEBELUM rpc reissue (urutan dalam tubuh action)", () => {
    const body = actions.slice(
      actions.indexOf("export async function reissueCertificate"),
      actions.indexOf("export async function revokeCertificate"),
    );
    expect(body).toMatch(/evaluateLevelEligibility\(supabase, row\.enrollment_id, row\.level_id\)/);
    expect(body).toMatch(/NOT_ELIGIBLE/);
    // Evaluator dipanggil lebih dulu dari RPC reissue → tak eligible = tanpa efek.
    expect(body.indexOf("evaluateLevelEligibility(")).toBeGreaterThan(-1);
    expect(body.indexOf('rpc("reissue_certificate"')).toBeGreaterThan(
      body.indexOf("evaluateLevelEligibility("),
    );
    // Action ini TIDAK memakai jalur issuance biasa.
    expect(body).not.toMatch(/rpc\("issue_certificate"/);
    expect(body).toMatch(/p_reason: parsed\.data\.reason/);
    expect(body).toMatch(/error: "REISSUE_FAILED"/);
  });

  it("issueCertificate & reissueCertificate berbagi evaluator eligibility yang sama", () => {
    expect(actions).toMatch(/async function evaluateLevelEligibility/);
    const issueBody = actions.slice(
      actions.indexOf("export async function issueCertificate"),
      actions.indexOf("export async function reissueCertificate"),
    );
    expect(issueBody).toMatch(
      /evaluateLevelEligibility\(supabase, parsed\.data\.enrollmentId, parsed\.data\.levelId\)/,
    );
    expect(issueBody).toMatch(/rpc\("issue_certificate"/);
  });
});

describe("migration 000010: constraint, index partial, RPC atomik", () => {
  it("drop constraint all-status + index partial satu-ACTIVE per enrollment-level", () => {
    expect(migration).toMatch(/drop constraint if exists certificates_enrollment_id_level_id_key/);
    expect(migration).toMatch(/create unique index certificates_one_active/);
    expect(migration).toMatch(/where status = 'active'/);
  });

  it("issue_certificate diamendemen memakai conflict target partial (regresi live-run)", () => {
    expect(migration).toMatch(/on conflict \(enrollment_id, level_id\) where status = 'active' do nothing/);
  });

  it("reissue_certificate: definer + search_path tetap + revoke PUBLIC + audit 1 baris", () => {
    expect(migration).toMatch(/create or replace function private\.reissue_certificate/);
    expect(migration).toMatch(/language plpgsql security definer/);
    expect(migration).toMatch(/set search_path = private, public, pg_temp/);
    expect(migration).toMatch(/'certificate\.reissued'/);
    expect(migration).toMatch(
      /revoke all on function public\.reissue_certificate\(uuid, text, text\) from public/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.reissue_certificate\(uuid, text, text\) to authenticated/,
    );
  });
});

describe("UI reissue teacher (student detail)", () => {
  it("halaman memuat komponen dan menampilkan aksi hanya pada cert active", () => {
    expect(page).toMatch(/import \{ ReissueCertificateButton \} from "\.\/reissue-button"/);
    expect(page).toMatch(/c\.status === "active" && \(\s*<ReissueCertificateButton/);
    expect(page).toMatch(/diganti/);
  });

  it("komponen punya dialog alasan wajib + aksesibel (label, status)", () => {
    expect(button).toMatch(/showModal/);
    expect(button).toMatch(/aria-labelledby/);
    expect(button).toMatch(/Alasan reissue/);
    expect(button).toMatch(/required/);
    expect(button).toMatch(/minLength=\{MIN_REASON\}/);
    expect(button).toMatch(/const MIN_REASON = 5;/);
    expect(button).toMatch(/role="status"/);
    expect(button).toMatch(/reissueCertificate\(\{ certificateId, reason: trimmed \}\)/);
  });
});
