import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

/**
 * Defect ditemukan saat walkthrough guru (08 Sep 2026): tidak ada FK
 * enrollments→profiles, sehingga embed `enrollments(profiles(...))` gagal
 * PGRST200 dan SELURUH batch analitik guru jadi kosong (n=0) — padahal data
 * ada. Halaman /teacher/analytics diperbaiki dengan query profiles terpisah.
 * Guard ini memastikan bug tidak muncul kembali di halaman yang sama.
 */

describe("teacher analytics: no enrollments→profiles embed", () => {
  it("/teacher/analytics queries profiles separately (no PGRST200 embed)", () => {
    const src = readFileSync(resolve(root, "app/(teacher)/teacher/analytics/page.tsx"), "utf8");
    expect(src).not.toMatch(/from\("enrollments"\)[\s\S]{0,200}profiles\(/);
    expect(src).toMatch(/from\("profiles"\)\.select\("id,display_name"\)/);
  });

  it("certificates page keeps the same documented pattern", () => {
    const src = readFileSync(resolve(root, "app/(teacher)/teacher/certificates/page.tsx"), "utf8");
    expect(src).toMatch(/enrollments→profiles/);
  });
});
