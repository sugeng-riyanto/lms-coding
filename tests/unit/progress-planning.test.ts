import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_INTERVALS_DAYS,
  firstReviewDue,
  firstReviewInsertRows,
  isoWeekStart,
  isSameIsoWeek,
  nextReviewAfter,
  orderedReviewQueue,
  weeklyRollup,
} from "@/lib/progress-planning";

describe("isoWeekStart: minggu ISO dalam timezone org", () => {
  it("Senin siang WIB → week_start Senin itu", () => {
    // 2026-09-07 03:00 UTC = 10:00 WIB Senin.
    expect(isoWeekStart(new Date("2026-09-07T03:00:00Z"))).toBe("2026-09-07");
  });

  it("Minggu malam UTC yang sudah Senin di Jakarta → week_start Senin (tz matters)", () => {
    // 2026-09-06 20:00 UTC = 2026-09-07 03:00 WIB (Senin).
    expect(isoWeekStart(new Date("2026-09-06T20:00:00Z"), "Asia/Jakarta")).toBe("2026-09-07");
    // Instant yang sama dilihat sebagai Minggu di UTC → minggu sebelumnya.
    expect(isoWeekStart(new Date("2026-09-06T20:00:00Z"), "UTC")).toBe("2026-08-31");
  });

  it("tengah minggu → Senin minggu itu; rollover tahun → Desember tahun lalu", () => {
    expect(isoWeekStart(new Date("2026-09-09T12:00:00Z"))).toBe("2026-09-07"); // Rabu
    expect(isoWeekStart(new Date("2026-01-01T12:00:00Z"))).toBe("2025-12-29"); // Kamis
  });

  it("isSameIsoWeek benar di dalam & di luar minggu", () => {
    const mon = new Date("2026-09-07T03:00:00Z");
    const sun = new Date("2026-09-13T14:00:00Z");
    const nextMon = new Date("2026-09-14T03:00:00Z");
    expect(isSameIsoWeek(mon, "2026-09-07")).toBe(true);
    expect(isSameIsoWeek(sun, "2026-09-07")).toBe(true);
    expect(isSameIsoWeek(nextMon, "2026-09-07")).toBe(false);
  });
});

describe("weeklyRollup: progress vs target mingguan", () => {
  it("belum mencapai target → active dengan pct dihitung", () => {
    expect(weeklyRollup({ completedThisWeek: 1, goalValue: 3 })).toEqual({
      completed: 1,
      goal: 3,
      pct: 33,
      achieved: false,
      status: "active",
    });
  });

  it("mencapai target → completed 100; lebih → clamp 100", () => {
    expect(weeklyRollup({ completedThisWeek: 3, goalValue: 3 }).status).toBe("completed");
    expect(weeklyRollup({ completedThisWeek: 5, goalValue: 3 })).toMatchObject({
      pct: 100,
      achieved: true,
      status: "completed",
    });
  });

  it("defensif: negatif dianggap 0; goal di-clamp ke rentang 1..50", () => {
    expect(weeklyRollup({ completedThisWeek: -2, goalValue: 0 })).toMatchObject({
      completed: 0,
      goal: 1,
      pct: 0,
      status: "active",
    });
  });
});

describe("jadwal review: ladder 1/3/7/14 (LEARNING_ENGINE.md)", () => {
  const completedAt = new Date("2026-09-07T03:00:00Z");

  it("review pertama = interval 1 → due +1 hari", () => {
    expect(firstReviewDue(completedAt)).toEqual({
      intervalIdx: 1,
      dueAt: new Date("2026-09-08T03:00:00Z"),
    });
  });

  it("confidence ≥ 4 → maju satu anak tangga", () => {
    expect(nextReviewAfter({ completedAt, confidence: 4, intervalIdx: 1 })).toEqual({
      intervalIdx: 2,
      dueAt: new Date("2026-09-10T03:00:00Z"), // +3 hari
    });
  });

  it("confidence ≥ 4 di anak tangga terakhir → tetap (cap 14 hari)", () => {
    const due = nextReviewAfter({ completedAt, confidence: 5, intervalIdx: 4 });
    expect(due.intervalIdx).toBe(4);
    expect(due.dueAt).toEqual(new Date("2026-09-21T03:00:00Z")); // +14 hari
  });

  it("confidence = 3 → ulangi interval yang sama", () => {
    expect(nextReviewAfter({ completedAt, confidence: 3, intervalIdx: 2 }).intervalIdx).toBe(2);
  });

  it("confidence ≤ 2 → reset ke interval pertama (+1 hari)", () => {
    expect(nextReviewAfter({ completedAt, confidence: 1, intervalIdx: 3 })).toEqual({
      intervalIdx: 1,
      dueAt: new Date("2026-09-08T03:00:00Z"),
    });
    expect(nextReviewAfter({ completedAt, confidence: 2, intervalIdx: 4 }).intervalIdx).toBe(1);
  });

  it("interval default sama dengan konstanta ladder", () => {
    expect([...DEFAULT_REVIEW_INTERVALS_DAYS]).toEqual([1, 3, 7, 14]);
  });
});

describe("firstReviewInsertRows: hook level-completion (ADR-011)", () => {
  const now = new Date("2026-09-07T03:00:00Z");

  it("satu baris per level, due +1 hari (interval pertama), status scheduled", () => {
    const rows = firstReviewInsertRows("enr-1", ["lv-b", "lv-a"], now);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      enrollment_id: "enr-1",
      entity_type: "level",
      entity_id: "lv-a",
      due_at: "2026-09-08T03:00:00.000Z",
      interval_idx: 1,
      status: "scheduled",
    });
  });

  it("id unik + urut stabil (duplikat dihapus, sort naik)", () => {
    const rows = firstReviewInsertRows("enr-1", ["lv-b", "lv-a", "lv-b"], now);
    expect(rows.map((r) => r.entity_id)).toEqual(["lv-a", "lv-b"]);
  });

  it("list kosong → tidak ada baris", () => {
    expect(firstReviewInsertRows("enr-1", [], now)).toEqual([]);
  });
});

describe("orderedReviewQueue: overdue → hari ini → berikutnya", () => {
  // now = Senin 2026-09-07 10:00 WIB (= 03:00 UTC); "hari ini" berakhir
  // 2026-09-08 00:00 WIB (= 2026-09-07 17:00 UTC).
  const now = new Date("2026-09-07T03:00:00Z");
  const mk = (
    id: string,
    due: string,
    mastery = 0.5,
  ): { id: string; title: string; dueAt: Date; mastery: number } => ({
    id,
    title: `item ${id}`,
    dueAt: new Date(due),
    mastery,
  });

  it("mengurutkan tiga tier secara berurutan", () => {
    const overdue = mk("b", "2026-09-07T02:00:00Z");
    const today = mk("a", "2026-09-07T10:00:00Z");
    const upcoming = mk("c", "2026-09-08T01:00:00Z");
    const out = orderedReviewQueue([upcoming, today, overdue], { now });
    expect(out.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("due tepat 00:00 besok WIB masuk tier berikutnya, bukan hari ini", () => {
    const todayLate = mk("a", "2026-09-07T16:59:00Z");
    const boundary = mk("b", "2026-09-07T17:00:00Z"); // = 2026-09-08 00:00 WIB
    const out = orderedReviewQueue([boundary, todayLate], { now });
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("tie-break dalam tier sama: due_at naik, lalu mastery terendah, lalu id", () => {
    const same = new Date("2026-09-07T02:00:00Z");
    const highMastery = { ...mk("x", same.toISOString(), 0.9) };
    const lowMastery = { ...mk("y", same.toISOString(), 0.2) };
    expect(orderedReviewQueue([highMastery, lowMastery], { now }).map((x) => x.id)).toEqual(["y", "x"]);
  });

  it("tidak memodifikasi array masukan", () => {
    const items = [mk("z", "2026-09-07T02:00:00Z")];
    orderedReviewQueue(items, { now });
    expect(items).toHaveLength(1);
  });
});
