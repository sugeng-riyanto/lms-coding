import { describe, expect, it } from "vitest";
import { assessmentPercent, autoGrade, normalizeShortText, questionScore } from "@/lib/grading";

describe("autoGrade fixtures", () => {
  it("single_choice benar/salah", () => {
    expect(autoGrade({ type: "single_choice", points: 10, correctOptionId: "b" }, "b")).toBe(10);
    expect(autoGrade({ type: "single_choice", points: 10, correctOptionId: "b" }, "a")).toBe(0);
  });
  it("multiple_choice harus exact set", () => {
    const rule = { type: "multiple_choice" as const, points: 10, correctOptionIds: ["a", "c"] };
    expect(autoGrade(rule, ["a", "c"])).toBe(10);
    expect(autoGrade(rule, ["c", "a"])).toBe(10);
    expect(autoGrade(rule, ["a"])).toBe(0);
    expect(autoGrade(rule, ["a", "b", "c"])).toBe(0);
  });
  it("true/false", () => {
    expect(autoGrade({ type: "true_false", points: 5, correctOptionId: "true" }, "true")).toBe(5);
    expect(autoGrade({ type: "true_false", points: 5, correctOptionId: "true" }, "false")).toBe(0);
  });
  it("numeric tolerance absolut & relatif", () => {
    expect(
      autoGrade({ type: "numeric_tolerance", points: 10, expected: 100, toleranceAbsolute: 0.5 }, 100.4),
    ).toBe(10);
    expect(
      autoGrade({ type: "numeric_tolerance", points: 10, expected: 100, toleranceAbsolute: 0.5 }, 101),
    ).toBe(0);
    expect(
      autoGrade({ type: "numeric_tolerance", points: 10, expected: 200, toleranceRelative: 0.01 }, 201),
    ).toBe(10);
    expect(
      autoGrade({ type: "numeric_tolerance", points: 10, expected: 200, toleranceRelative: 0.01 }, 205),
    ).toBe(0);
  });
  it("short_text normalisasi eksplisit", () => {
    const rule = { type: "short_text" as const, points: 10, acceptedAnswers: ["Soekarno"] };
    expect(autoGrade(rule, "  soekarno ")).toBe(10);
    expect(autoGrade(rule, "Hatta")).toBe(0);
    expect(normalizeShortText("  A   B ")).toBe("a b");
  });
  it("tanpa acceptedAnswers → manual (0)", () => {
    expect(autoGrade({ type: "short_text", points: 10, acceptedAnswers: [] }, "apapun")).toBe(0);
  });
  it("essay/file selalu 0 (moderation queue)", () => {
    expect(autoGrade({ type: "essay_manual", points: 20 }, "esai panjang")).toBe(0);
    expect(autoGrade({ type: "file_manual", points: 20 }, {})).toBe(0);
  });
});

describe("score aggregation", () => {
  it("clamp question score", () => {
    expect(questionScore(8, 5, 10)).toBe(10);
    expect(questionScore(0, null, 10)).toBe(0);
  });
  it("assessment percent", () => {
    expect(assessmentPercent([8, 10], [10, 10])).toBe(90);
    expect(assessmentPercent([], [])).toBe(0);
  });
});
