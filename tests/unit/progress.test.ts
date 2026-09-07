import { describe, expect, it } from "vitest";
import { computeUnlock, detectRisk, nextBestAction } from "@/lib/progress";

describe("prerequisite/unlock server-side", () => {
  it("locked sampai prereq selesai", () => {
    const m = computeUnlock(["a", "b"], new Set(["a"]), [{ targetId: "b", requiredIds: ["a"] }]);
    expect(m.get("b")).toBe("available");
    const m2 = computeUnlock(["a", "b"], new Set(), [{ targetId: "b", requiredIds: ["a"] }]);
    expect(m2.get("b")).toBe("locked");
  });
});

describe("next-best-action menjelaskan alasan", () => {
  it("deadline dekat diprioritaskan", () => {
    const r = nextBestAction([
      { id: "a", title: "A", mastery: 0.9, deadlineInDays: 10, locked: false, lastActivityDaysAgo: 0 },
      { id: "b", title: "B", mastery: 0.9, deadlineInDays: 1, locked: false, lastActivityDaysAgo: 0 },
    ]);
    expect(r?.id).toBe("b");
    expect(r?.reason).toMatch(/Deadline/);
  });
  it("mastery rendah → remedial", () => {
    const r = nextBestAction([
      { id: "a", title: "A", mastery: 0.3, deadlineInDays: null, locked: false, lastActivityDaysAgo: 0 },
      { id: "b", title: "B", mastery: 0.9, deadlineInDays: null, locked: false, lastActivityDaysAgo: 0 },
    ]);
    expect(r?.id).toBe("a");
    expect(r?.reason).toMatch(/remedial/);
  });
});

describe("risk signals explainable", () => {
  it("mendeteksi inaktif & rush", () => {
    const s = detectRisk({
      inactiveDays: 10,
      attemptsLast7d: 1,
      scoreDelta: 5,
      avgSecondsPerItem: 10,
      accuracy: 0.3,
      prereqMastery: 0.9,
      progressPct: 60,
      expectedPct: 65,
    });
    expect(s.map((x) => x.code)).toContain("INACTIVE");
    expect(s.map((x) => x.code)).toContain("RUSH_LOW_ACCURACY");
    for (const sig of s) expect(sig.message.length).toBeGreaterThan(10);
  });
  it("tampilan inaktif dibatasi 30+ hari", () => {
    const s = detectRisk({
      inactiveDays: 999,
      attemptsLast7d: 0,
      scoreDelta: 0,
      avgSecondsPerItem: 60,
      accuracy: 1,
      prereqMastery: 1,
      progressPct: 0,
      expectedPct: 70,
    });
    expect(s.map((x) => x.code)).toContain("INACTIVE");
    expect(s.find((x) => x.code === "INACTIVE")?.message).toMatch(/30\+ hari/);
    expect(s.find((x) => x.code === "INACTIVE")?.message).not.toMatch(/999/);
  });
});
