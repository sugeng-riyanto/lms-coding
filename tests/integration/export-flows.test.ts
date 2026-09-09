import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * RBAC export flows — every role can export the data they can see:
 * - Student: GET /api/export/me/transcript (own attempts, progress, certs)
 * - Guardian: GET /api/export/guardian/summary?studentId= (linked child)
 * - Teacher: GET /api/teacher/export?cohortId= (cohort grades/progress)
 * - Teacher analytics page has an Export CSV link
 */
const transcript = readFileSync("app/api/export/me/transcript/route.ts", "utf8");
const guardian = readFileSync("app/api/export/guardian/summary/route.ts", "utf8");
const teacherExport = readFileSync("app/api/teacher/export/route.ts", "utf8");
const analyticsPage = readFileSync("app/(teacher)/teacher/analytics/page.tsx", "utf8");
const guardianPage = readFileSync("app/(guardian)/guardian/page.tsx", "utf8");
const certPage = readFileSync("app/(student)/certificates/page.tsx", "utf8");
const analyticsDict = readFileSync("lib/ui-text/analytics.ts", "utf8");
const guardianDict = readFileSync("lib/ui-text/guardian.ts", "utf8");

describe("student transcript export", () => {
  it("exists and exports own data only (auth-gated)", () => {
    expect(transcript).toMatch(/api\/export\/me\/transcript/);
    expect(transcript).toMatch(/UNAUTHENTICATED/);
    expect(transcript).toMatch(/checkRateLimit/);
    expect(transcript).toMatch(/from\("attempts"\)/);
    expect(transcript).toMatch(/from\("certificates"\)/);
    expect(transcript).toMatch(/from\("progress_snapshots"\)/);
    expect(transcript).toMatch(/text\/csv/);
  });

  it("bounded to own enrollments via student_id = auth uid pattern", () => {
    expect(transcript).toMatch(/from\("enrollments"\)/);
    expect(transcript).toMatch(/eq\("student_id", userId\)/);
    expect(transcript).toMatch(/in\("enrollment_id", enrIds\)/);
  });

  it("certificates page links to the transcript export", () => {
    expect(certPage).toMatch(/\/api\/export\/me\/transcript/);
    expect(certPage).toMatch(/Ekspor transkrip belajar/);
  });
});

describe("guardian summary export", () => {
  it("exists, is guardian-auth-gated, and checks active link", () => {
    expect(guardian).toMatch(/api\/export\/guardian\/summary/);
    expect(guardian).toMatch(/UNAUTHENTICATED/);
    expect(guardian).toMatch(/FORBIDDEN/);
    expect(guardian).toMatch(/guardian_links/);
    expect(guardian).toMatch(/eq\("status", "active"\)/);
    expect(guardian).toMatch(/checkRateLimit/);
  });

  it("exports only permitted summary data (no answers/scores)", () => {
    // Progress + certificates only — never attempts/responses.
    expect(guardian).toMatch(/from\("progress_snapshots"\)/);
    expect(guardian).toMatch(/from\("certificates"\)/);
    expect(guardian).not.toMatch(/from\("attempts"\)/);
    expect(guardian).not.toMatch(/from\("responses"\)/);
  });

  it("guardian page has the export button wired to the route", () => {
    expect(guardianPage).toMatch(/api\/export\/guardian\/summary/);
    expect(guardianPage).toMatch(/t\("exportSummary"\)/);
  });

  it("guardian dict has bilingual exportSummary label", () => {
    expect(guardianDict).toMatch(/exportSummary:/);
    expect(guardianDict).toMatch(/Ekspor ringkasan/);
    expect(guardianDict).toMatch(/Export summary/);
  });
});

describe("teacher analytics export", () => {
  it("teacher export route still provides cohort CSV", () => {
    expect(teacherExport).toMatch(/api\/teacher\/export/);
    expect(teacherExport).toMatch(/cohortId/);
    expect(teacherExport).toMatch(/text\/csv/);
  });

  it("analytics page links to teacher export with selected cohort", () => {
    expect(analyticsPage).toMatch(/api\/teacher\/export\?cohortId=/);
    expect(analyticsPage).toMatch(/t\("exportCsv"\)/);
  });

  it("analytics dict has bilingual exportCsv label", () => {
    expect(analyticsDict).toMatch(/exportCsv:/);
    expect(analyticsDict).toMatch(/Ekspor CSV/);
    expect(analyticsDict).toMatch(/Export CSV/);
  });
});
