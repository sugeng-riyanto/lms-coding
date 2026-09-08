import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(teacher)/teacher/certificates/page.tsx", "utf8");
const button = readFileSync("app/(teacher)/teacher/certificates/anchor-batch-button.tsx", "utf8");
const refreshButton = readFileSync("app/(teacher)/teacher/certificates/anchor-refresh-button.tsx", "utf8");
const actions = readFileSync("features/actions.ts", "utf8");
const chip = readFileSync("components/anchor-status.tsx", "utf8");
const studentPage = readFileSync("app/(teacher)/teacher/students/[studentId]/page.tsx", "utf8");
const dashboard = readFileSync("app/(teacher)/teacher/page.tsx", "utf8");
const certText = readFileSync("lib/ui-text/cert.ts", "utf8");
const dashText = readFileSync("lib/ui-text/dash.ts", "utf8");

describe("halaman /teacher/certificates — anchoring UI guru (bilingual dictionary)", () => {
  it("route teacher force-dynamic + daftar sertifikat dengan status anchor per baris", () => {
    expect(page).toMatch(/export const dynamic = "force-dynamic"/);
    expect(page).toMatch(/from\("certificates"\)/);
    expect(page).toMatch(/chain_anchors\(status,transaction_ref,network\)/);
    expect(page).toMatch(/AnchorStatusChip/);
    // Scope cohort (defense-in-depth di atas RLS certs_teacher_all).
    expect(page).toMatch(/\.in\("enrollments\.cohort_id", cohortIds\)/);
    // Defect terperbaiki: schema tak punya FK enrollments→profiles, jadi embed
    // `enrollments(profiles(display_name))` tak pernah resolve (PGRST200 → 0 baris).
    // Nama murid kini diselesaikan via query `profiles` terpisah yang cohort-scoped.
    expect(page).toMatch(/from\("profiles"\)\.select\("id,display_name"\)/);
    expect(page).toMatch(/\.in\("id", studentIds\)/);
    expect(page).not.toMatch(/profiles\(display_name\)\)/);
  });

  it("gerbang feature flag: AnchorBatchButton hanya saat isChainEnabled; catatan nonaktif jelas", () => {
    expect(page).toMatch(/isChainEnabled\(\)/);
    expect(page).toMatch(/chainEnabled \? \(/);
    // Catatan nonaktif ada di dictionary per-halaman (kedua bahasa).
    expect(certText).toMatch(/BLOCKCHAIN_ANCHOR_ENABLED=false/);
    expect(certText).toMatch(/ADR-018/);
    expect(certText).toMatch(/en: "Anchoring is disabled/);
  });

  it("button client: anchorCertificateBatch + copy bilingual via dictionary; TIDAK diklaim verified sebelum final", () => {
    expect(button).toMatch(/"use client"/);
    expect(button).toMatch(/anchorCertificateBatch\(\)/);
    expect(button).toMatch(/mkT\(CERT, lang\)/);
    expect(certText).toMatch(/batchIdle: \{ id: "Anchor batch sertifikat", en: "Anchor certificate batch"/);
    // Kode error tetap token di client (dipetakan ke copy via dictionary).
    expect(button).toMatch(/BLOCKCHAIN_PROVIDER_PENDING/);
    expect(button).toMatch(/BLOCKCHAIN_DISABLED/);
    expect(button).not.toMatch(/blockchain verified/);
  });

  it("chip: teks membedakan final/pending/failed/tidak di-anchor (bukan warna saja), dua bahasa", () => {
    expect(chip).toMatch(/mkT\(CERT, lang\)/);
    expect(certText).toMatch(/chipFinal: \{ id: "✓ anchor final", en: "✓ anchor final"/);
    expect(certText).toMatch(/chipPending: \{ id: "anchor pending", en: "anchor pending"/);
    expect(certText).toMatch(/chipFailed: \{ id: "anchor gagal", en: "anchor failed"/);
    expect(certText).toMatch(/chipNone: \{ id: "tidak di-anchor", en: "not anchored"/);
  });

  it("halaman murid menampilkan chip anchor per sertifikat", () => {
    expect(studentPage).toMatch(/from\("certificates"\)/);
    expect(studentPage).toMatch(/chain_anchors\(status,transaction_ref,network\)/);
    expect(studentPage).toMatch(/AnchorStatusChip[\s\S]*?chain_anchors\?\.status \?\? null/);
  });

  it("dashboard guru menautkan ke /teacher/certificates (copy via dictionary)", () => {
    expect(dashboard).toMatch(/["']\/teacher\/certificates["']/);
    expect(dashText).toMatch(
      /toolCertificates: \{ id: "Sertifikat & anchoring", en: "Certificates & anchoring"/,
    );
  });

  it("halaman menampilkan tombol refresh status anchor di samping batch", () => {
    expect(page).toMatch(/AnchorRefreshButton/);
    expect(refreshButton).toMatch(/"use client"/);
    expect(refreshButton).toMatch(/refreshAnchorStatus\(\)/);
    expect(refreshButton).toMatch(/mkT\(CERT, lang\)/);
    expect(certText).toMatch(/refreshIdle: \{ id: "Refresh status anchor", en: "Refresh anchor status"/);
  });

  it("refreshAnchorStatus: gating membership→flag→Noop, hanya 'final' yang diterapkan", () => {
    expect(actions).toMatch(/export async function refreshAnchorStatus\(\)/);
    // urutan gate sama dengan batch: claims → membership teacher aktif → flag → Noop.
    const start = actions.indexOf("export async function refreshAnchorStatus()");
    const body = actions.slice(start);
    expect(body).toMatch(/memberships/);
    expect(body).toMatch(/eq\("role", "teacher"\)/);
    expect(body).toMatch(/isChainEnabled\(\)/);
    expect(body).toMatch(/instanceof NoopChainAdapter/);
    // hanya naik ke final; status lain (pending/failed) tidak menurunkan row.
    expect(body).toMatch(/st\.status === "final"/);
    expect(body).toMatch(/update\(\{\s*status: "final"/);
  });
});
