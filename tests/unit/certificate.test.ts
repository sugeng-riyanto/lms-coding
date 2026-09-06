import { describe, expect, it } from "vitest";
import { checkEligibility } from "@/lib/eligibility";
import { merkleProof, merkleRoot, verifyProof } from "@/lib/merkle";

const rule = {
  passingScore: 70,
  masteryThreshold: 0.7,
  criticalCompetencies: ["K1"],
  weights: { formative: 30, summative: 50, project: 20 },
};

describe("eligibility evaluator (server-side)", () => {
  it("layak bila semua syarat terpenuhi", () => {
    const r = checkEligibility({
      requiredLessonIds: ["l1", "l2"],
      completedLessonIds: ["l1", "l2"],
      levelPercent: 80,
      summativePassed: true,
      mastery: new Map([["K1", 0.8]]),
      rule,
    });
    expect(r.eligible).toBe(true);
    expect(r.reasons).toEqual([]);
  });
  it("ditolak dengan alasan jelas bila lesson kurang", () => {
    const r = checkEligibility({
      requiredLessonIds: ["l1", "l2"],
      completedLessonIds: ["l1"],
      levelPercent: 80,
      summativePassed: true,
      mastery: new Map([["K1", 0.8]]),
      rule,
    });
    expect(r.eligible).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/1 lesson wajib/);
  });
  it("ditolak bila summative belum passed", () => {
    const r = checkEligibility({
      requiredLessonIds: ["l1"],
      completedLessonIds: ["l1"],
      levelPercent: 90,
      summativePassed: false,
      mastery: new Map([["K1", 0.9]]),
      rule,
    });
    expect(r.eligible).toBe(false);
  });
});

describe("merkle batch (tanpa PII)", () => {
  it("root deterministik & kosong null", () => {
    expect(merkleRoot([])).toBeNull();
    expect(merkleRoot(["a", "b"])).toBe(merkleRoot(["b", "a"]));
    expect(merkleRoot(["a", "b"])).toMatch(/^[0-9a-f]{64}$/);
  });
  it("proof valid untuk tiap leaf; rusak terdeteksi", () => {
    const leaves = ["h1", "h2", "h3"];
    for (let i = 0; i < leaves.length; i++) {
      const p = merkleProof(leaves, i);
      expect(p).not.toBeNull();
      expect(verifyProof(p as NonNullable<typeof p>)).toBe(true);
    }
    const p = merkleProof(leaves, 0);
    expect(p).not.toBeNull();
    if (p) expect(verifyProof({ ...p, leaf: "tampered" })).toBe(false);
  });
  it("duplicate anchoring: root sama untuk batch sama", () => {
    expect(merkleRoot(["x", "y"])).toBe(merkleRoot(["x", "y"]));
  });
});
