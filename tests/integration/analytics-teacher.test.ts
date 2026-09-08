import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(teacher)/teacher/analytics/page.tsx", "utf8");
const layout = readFileSync("app/(teacher)/layout.tsx", "utf8");
const filters = readFileSync("app/(teacher)/teacher/analytics/analytics-filters.tsx", "utf8");
const lib = readFileSync("lib/analytics-teacher.ts", "utf8");
const dashboard = readFileSync("app/(teacher)/teacher/page.tsx", "utf8");
const analyticsText = readFileSync("lib/ui-text/analytics.ts", "utf8");
const dashText = readFileSync("lib/ui-text/dash.ts", "utf8");

describe("halaman /teacher/analytics — Phase 5 insight guru", () => {
  it("route di dalam grup (teacher) yang di-guard dan force-dynamic", () => {
    expect(page).toMatch(/export const dynamic = "force-dynamic"/);
    // Grup (teacher) dilindungi layout requireActiveMembership(["teacher"]).
    expect(layout).toMatch(/requireActiveMembership\(\["teacher"\]\)/);
  });

  it("memakai lib analytics-item & analytics-teacher (metrik berversi)", () => {
    expect(page).toMatch(/from "@\/lib\/analytics-item"/);
    expect(page).toMatch(/itemStatistics\(rows\)/);
    expect(page).toMatch(/distractorMap\(rows\)/);
    expect(page).toMatch(/from "@\/lib\/analytics-teacher"/);
    expect(page).toMatch(/bottleneckAnalysis\(/);
    expect(page).toMatch(/buildTeacherDigest\(/);
    expect(page).toMatch(/ITEM_METRIC_DEFINITIONS_VERSION/);
    expect(page).toMatch(/TEACHER_ANALYTICS_DEFINITIONS_VERSION/);
  });

  it("read-only: createClient (RLS), bukan createStrictClient/service; tanpa aksi tulis", () => {
    expect(page).toMatch(/from "@\/lib\/supabase\/server"/);
    expect(page).not.toMatch(/createStrictClient/);
    expect(page).not.toMatch(/createServiceClient/);
    expect(page).not.toMatch(/\.insert\(/);
    expect(page).not.toMatch(/\.update\(/);
    expect(page).not.toMatch(/\.delete\(/);
  });

  it("hanya query batch (.in), bukan loop per-baris (hindari N+1 dashboard)", () => {
    const inCount = (page.match(/\.in\(/g) ?? []).length;
    expect(inCount).toBeGreaterThanOrEqual(8);
    // Tidak ada perulangan for-of yang memanggil supabase di dalamnya.
    expect(page).not.toMatch(/for \(const .* of .*\) \{\s*\n\s*const \{ data: /);
  });

  it("tabel yang dibaca semuanya ber-policy guru (attempts/responses/question_versions/questions/learning_events/progress_snapshots/alerts)", () => {
    expect(page).toMatch(/\.from\("attempts"\)/);
    expect(page).toMatch(/\.from\("responses"\)/);
    expect(page).toMatch(/\.from\("question_versions"\)/);
    expect(page).toMatch(/\.from\("questions"\)/);
    expect(page).toMatch(/\.from\("learning_events"\)/);
    expect(page).toMatch(/\.from\("progress_snapshots"\)/);
    expect(page).toMatch(/\.from\("alerts"\)/);
    // Kepemilikan cohort eksplisit (defense-in-depth).
    expect(page).toMatch(/\.from\("cohorts"\)/);
    expect(page).toMatch(/eq\("teacher_id", userId \?\? ""\)/);
    expect(page).toMatch(/selectedCohort = cohorts\.find/);
  });

  it("UI menampilkan n/sample size, last updated, versi; tanpa ranking publik", () => {
    expect(page).toMatch(/new Date\(lastUpdated\)/);
    expect(page).toMatch(/mkT\(ANALYTICS, lang\)/);
    // copy bilingual tinggal di dictionary per-halaman (kedua bahasa hadir).
    expect(analyticsText).toMatch(/footer: \{\s*id: "Definisi metrik/);
    expect(analyticsText).toMatch(/ukuran sampel \(n\)/);
    expect(analyticsText).toMatch(/sample size \(n\)/);
    expect(analyticsText).toMatch(/severityHigh: \{ id: "Hambatan", en: "Bottleneck"/);
    expect(analyticsText).toMatch(/severityWatch: \{ id: "Perhatikan", en: "Watch"/);
    expect(analyticsText).toMatch(/severityOk: \{ id: "Normal", en: "Normal"/);
    // Tidak ada leaderboard/ranking per murid.
    expect(page).not.toMatch(/ranking|leaderboard/i);
  });

  it("filter cohort+assessment sebagai client component dengan navigasi", () => {
    expect(filters).toMatch(/"use client"/);
    expect(filters).toMatch(/router\.push\(`\/teacher\/analytics\?/);
    expect(filters).toMatch(/assessmentId/);
  });

  it("link Analitik kelas dari dashboard guru (copy via dictionary)", () => {
    expect(dashboard).toMatch(/["']\/teacher\/analytics["']/);
    expect(dashText).toMatch(/toolAnalytics: \{ id: "Analitik kelas", en: "Class analytics"/);
  });

  it("grafik nyata: distribusi kelas memakai ColumnChart + percentDistribution (data server)", () => {
    expect(page).toMatch(/from "@\/components\/charts"/);
    expect(page).toMatch(/percentDistribution\(/);
    expect(page).toMatch(/CLASS_DISTRIBUTION_DEFINITIONS_VERSION/);
    expect(page).toMatch(/<ColumnChart/);
    expect(page).toMatch(/progress_snapshots/);
    // Setiap grafik membawa definisi + sample size (n) — bukan pajangan.
    expect(analyticsText).toMatch(/distTitle: \{ id: "Distribusi kelas", en: "Class distribution"/);
    expect(analyticsText).toMatch(/\{n} murid berenrollment aktif/);
    expect(analyticsText).toMatch(/\{n} actively enrolled students/);
    expect(analyticsText).toMatch(/n = \{n} attempt dinilai/);
  });
});

describe("lib/analytics-teacher — bottleneck & digest murni", () => {
  it("mengekspor fungsi + konstanta versi + guard minN", () => {
    expect(lib).toMatch(/export const TEACHER_ANALYTICS_DEFINITIONS_VERSION/);
    expect(lib).toMatch(/export function bottleneckAnalysis/);
    expect(lib).toMatch(/export function buildTeacherDigest/);
    expect(lib).toMatch(/BOTTLENECK_MIN_N = 3/);
    expect(lib).toMatch(/insufficient/);
  });
});
