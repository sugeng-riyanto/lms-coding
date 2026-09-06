import { describe, expect, it } from "vitest";
import { buildGradingRule, canShowScore, sanitizeQuestionForAttempt } from "@/lib/attempt";
import { autoGrade } from "@/lib/grading";

describe("sanitasi soal untuk browser", () => {
  it("tidak ada grading/explanation yang lolos", () => {
    const q = sanitizeQuestionForAttempt({
      questionVersionId: "qv1",
      position: 0,
      points: 10,
      type: "single_choice",
      promptJson: { text: "2+2?", options: ["3", "4"] },
    });
    expect(JSON.stringify(q)).not.toMatch(/correct|grading|explanation/i);
    expect(q.promptText).toBe("2+2?");
    expect(q.options).toEqual(["3", "4"]);
  });
});

describe("release policy", () => {
  it("immediate: skor tampil setelah submit", () => {
    expect(canShowScore("immediate", "submitted")).toBe(true);
    expect(canShowScore("immediate", "in_progress")).toBe(false);
  });
  it("manual: skor tampil hanya setelah finalized", () => {
    expect(canShowScore("manual", "submitted")).toBe(false);
    expect(canShowScore("manual", "finalized")).toBe(true);
  });
});

describe("fixture builder → autoGrade cocok hitungan manual", () => {
  it("numeric tolerance fixture", () => {
    const rule = buildGradingRule("numeric_tolerance", 10, { expected: "3.14", tolAbs: "0.01", tolRel: "0" });
    expect(autoGrade(rule, 3.145)).toBe(10); // manual: |3.145-3.14|=0.005 ≤ 0.01
    expect(autoGrade(rule, 3.2)).toBe(0);
  });
  it("multiple choice exact-set fixture", () => {
    const rule = buildGradingRule("multiple_choice", 10, { corrects: "a,c" });
    expect(autoGrade(rule, ["c", "a"])).toBe(10);
    expect(autoGrade(rule, ["a"])).toBe(0); // tanpa partial credit default
  });
  it("forged client score tidak dipakai: autoGrade dihitung ulang server", () => {
    const rule = buildGradingRule("single_choice", 10, { correct: "b" });
    expect(autoGrade(rule, "a")).toBe(0); // kiriman {score:100} dari client diabaikan
  });
});
