import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(teacher)/teacher/certificates/page.tsx", "utf8");
const button = readFileSync("app/(teacher)/teacher/certificates/anchor-batch-button.tsx", "utf8");
const chip = readFileSync("components/anchor-status.tsx", "utf8");
const studentPage = readFileSync("app/(teacher)/teacher/students/[studentId]/page.tsx", "utf8");
const dashboard = readFileSync("app/(teacher)/teacher/page.tsx", "utf8");

describe("halaman /teacher/certificates — anchoring UI guru", () => {
  it("route teacher force-dynamic + daftar sertifikat dengan status anchor per baris", () => {
    expect(page).toMatch(/export const dynamic = "force-dynamic"/);
    expect(page).toMatch(/from\("certificates"\)/);
    expect(page).toMatch(/chain_anchors\(status,transaction_ref,network\)/);
    expect(page).toMatch(/AnchorStatusChip/);
    // Scope cohort (defense-in-depth di atas RLS certs_teacher_all).
    expect(page).toMatch(/\.in\("enrollments\.cohort_id", cohortIds\)/);
    expect(page).toMatch(/enrollments\(student_id,profiles\(display_name\)\)/);
  });

  it("gerbang feature flag: AnchorBatchButton hanya saat isChainEnabled; catatan nonaktif jelas", () => {
    expect(page).toMatch(/isChainEnabled\(\)/);
    expect(page).toMatch(/chainEnabled \? \(/);
    expect(page).toMatch(/BLOCKCHAIN_ANCHOR_ENABLED=false/);
    expect(page).toMatch(/ADR-018/);
  });

  it("button client: anchorCertificateBatch + label 'anchor' TIDAK diklaim verified sebelum final", () => {
    expect(button).toMatch(/"use client"/);
    expect(button).toMatch(/anchorCertificateBatch\(\)/);
    expect(button).toMatch(/Anchor batch sertifikat/);
    expect(button).toMatch(/BLOCKCHAIN_PROVIDER_PENDING/);
    expect(button).toMatch(/BLOCKCHAIN_DISABLED/);
    expect(button).not.toMatch(/blockchain verified/);
  });

  it("chip: teks membedakan final/pending/failed/tidak di-anchor (bukan warna saja)", () => {
    expect(chip).toMatch(/anchor final/);
    expect(chip).toMatch(/anchor pending/);
    expect(chip).toMatch(/anchor gagal/);
    expect(chip).toMatch(/tidak di-anchor/);
  });

  it("halaman murid menampilkan chip anchor per sertifikat", () => {
    expect(studentPage).toMatch(/from\("certificates"\)/);
    expect(studentPage).toMatch(/chain_anchors\(status,transaction_ref,network\)/);
    expect(studentPage).toMatch(/AnchorStatusChip[\s\S]*?chain_anchors\?\.status \?\? null/);
  });

  it("dashboard guru menautkan ke /teacher/certificates", () => {
    expect(dashboard).toMatch(/href="\/teacher\/certificates"/);
    expect(dashboard).toMatch(/Sertifikat &amp; anchoring/);
  });
});
