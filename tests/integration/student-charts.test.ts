import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(student)/learn/page.tsx", "utf8");
const planningLib = readFileSync("lib/progress-planning.ts", "utf8");

describe("halaman /learn — grafik progres & perencanaan murid (data nyata)", () => {
  it("memakai ColumnChart/ChartPanel + agregasi per hari dari progress-planning", () => {
    expect(page).toMatch(/from "@\/components\/charts"/);
    expect(page).toMatch(/<ColumnChart/);
    expect(page).toMatch(/weekActiveMinutesByDay/);
    expect(planningLib).toMatch(/export function weekActiveMinutesByDay/);
  });

  it("sumber data asli, bukan angka pajangan: study_sessions & attempts.final_score", () => {
    expect(page).toMatch(/\.from\("study_sessions"\)/);
    expect(page).toMatch(/\.from\("attempts"\)/);
    expect(page).toMatch(/final_score/);
    expect(page).toMatch(/\.from\("assessments"\)/);
    // Menit dari detik aktif (heartbeat jujur), bukan buka-halaman.
    expect(page).toMatch(/heartbeat/);
    expect(page).toMatch(/di-clamp/);
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
    expect(page).toMatch(/Menit aktif minggu ini/);
    expect(page).toMatch(/Skor kuis terakhir/);
    expect(page).toMatch(/skor final \(0–100\)/i);
    expect(page).toMatch(/study_sessions/);
  });
});
