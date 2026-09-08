import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(student)/learn/page.tsx", "utf8");
const planningLib = readFileSync("lib/progress-planning.ts", "utf8");
const learnText = readFileSync("lib/ui-text/learn.ts", "utf8");

describe("halaman /learn — grafik progres & perencanaan murid (data nyata)", () => {
  it("memakai ColumnChart/ChartPanel + agregasi per hari dari progress-planning", () => {
    expect(page).toMatch(/from "@\/components\/charts"/);
    expect(page).toMatch(/<ColumnChart/);
    expect(page).toMatch(/weekActiveMinutesByDay/);
    expect(planningLib).toMatch(/export function weekActiveMinutesByDay/);
  });

  it("copy grafik bilingual (dictionary per-halaman): kedua bahasa ada", () => {
    expect(learnText).toMatch(
      /activeChartTitle: \{ id: "Menit aktif minggu ini", en: "Active minutes this week"/,
    );
    expect(learnText).toMatch(/quizChartTitle: \{ id: "Skor kuis terakhir", en: "Latest quiz scores"/);
    // Definisi jujur: skor final dihitung server (0–100), bukan browser.
    expect(learnText).toMatch(/Skor final \(0–100\)/);
    expect(learnText).toMatch(/final \(0–100\)/i);
    // Halaman menarik bahasa via getLang + dictionary.
    expect(page).toMatch(/getLang\(\)/);
    expect(page).toMatch(/mkT\(LEARN, lang\)/);
  });

  it("sumber data asli, bukan angka pajangan: study_sessions & attempts.final_score", () => {
    expect(page).toMatch(/\.from\("study_sessions"\)/);
    expect(page).toMatch(/\.from\("attempts"\)/);
    expect(page).toMatch(/final_score/);
    expect(page).toMatch(/\.from\("assessments"\)/);
    // Menit dari detik aktif (heartbeat jujur), bukan buka-halaman.
    expect(learnText).toMatch(/heartbeat/);
    expect(learnText).toMatch(/clamp/);
  });

  it("tidak membocorkan kunci/penilaian ke murid di halaman ini", () => {
    expect(page).not.toMatch(/grading_json/);
    expect(page).not.toMatch(/correctOptionIds/);
    expect(page).not.toMatch(/explanation/);
  });

  it("read-only via RLS: tanpa service client dan tanpa aksi tulis di halaman", () => {
    expect(page).toMatch(/from "@\/lib\/supabase\/server"/);
    expect(page).not.toMatch(/createStrictClient|createServiceClient/);
    expect(page).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });

  it("setiap grafik membawa definisi/konteks, bukan warna saja", () => {
    expect(learnText).toMatch(/study_sessions/);
    expect(learnText).toMatch(/attempts\.final_score/);
  });
});
