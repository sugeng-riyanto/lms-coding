import { describe, expect, it } from "vitest";
import { competencyMastery, evaluateLevelCompletion, validateWeights } from "@/lib/mastery";

describe("mastery", () => {
  it("weighted earned/possible", () => {
    const m = competencyMastery([
      { competencyId: "K1", earned: 8, possible: 10, weight: 1, critical: true },
      { competencyId: "K1", earned: 5, possible: 10, weight: 1, critical: true },
    ]);
    expect(m.get("K1")).toBeCloseTo(0.65);
  });
  it("weights harus 100%", () => {
    expect(validateWeights({ formative: 30, summative: 50, project: 20 })).toBe(true);
    expect(validateWeights({ formative: 30, summative: 30, project: 20 })).toBe(false);
  });
  it("level completion default rule", () => {
    const rule = {
      passingScore: 70,
      masteryThreshold: 0.7,
      criticalCompetencies: ["K1"],
      weights: { formative: 30, summative: 50, project: 20 },
    };
    const ok = evaluateLevelCompletion({
      requiredActivitiesCompleted: true,
      summativePassed: true,
      levelPercent: 80,
      mastery: new Map([["K1", 0.8]]),
      rule,
    });
    expect(ok.completed).toBe(true);
    const fail = evaluateLevelCompletion({
      requiredActivitiesCompleted: true,
      summativePassed: true,
      levelPercent: 80,
      mastery: new Map([["K1", 0.5]]),
      rule,
    });
    expect(fail.completed).toBe(false);
    expect(fail.reasons.join(" ")).toMatch(/K1/);
  });
});
