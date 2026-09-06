import { describe, expect, it } from "vitest";
import { summarizeCohort, type StudentRow } from "@/lib/analytics";

const NOW = new Date("2026-09-06T00:00:00Z");
const rows: StudentRow[] = [
  {
    studentId: "a",
    displayName: "A",
    progressPct: 80,
    mastery: 0.8,
    lastActivityAt: "2026-09-05T00:00:00Z",
    submittedCount: 2,
  },
  {
    studentId: "b",
    displayName: "B",
    progressPct: 40,
    mastery: 0.4,
    lastActivityAt: "2026-08-20T00:00:00Z",
    submittedCount: 1,
  },
  {
    studentId: "c",
    displayName: "C",
    progressPct: 60,
    mastery: 0.6,
    lastActivityAt: null,
    submittedCount: 0,
  },
];

describe("reconciliation ringkasan cohort", () => {
  it("cocok hitungan manual dari fixture", () => {
    const s = summarizeCohort(rows, NOW);
    expect(s.enrolled).toBe(3);
    expect(s.active7d).toBe(1); // hanya A dalam 7 hari
    expect(s.avgProgress).toBeCloseTo(60);
    expect(s.avgMastery).toBeCloseTo(0.6);
    expect(s.needsAttention).toBe(2); // B (progress<50 & inaktif), C (tanpa aktivitas)
  });
  it("kosong aman (sample size 0)", () => {
    expect(summarizeCohort([], NOW)).toEqual({
      enrolled: 0,
      active7d: 0,
      avgProgress: 0,
      avgMastery: 0,
      needsAttention: 0,
    });
  });
});
