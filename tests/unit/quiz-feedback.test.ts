import { describe, it, expect } from "vitest";
import { buildQuizFeedback } from "@/lib/quiz-feedback";

describe("buildQuizFeedback", () => {
  const base = {
    position: 0,
    points: 10,
    promptJson: { text: "What is 2+2?", options: ["3", "4", "5", "6"] },
    explanationJson: { text: "2 + 2 = 4." },
    feedbackJson: {},
  };

  it("single_choice correct", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-1", type: "single_choice", gradingJson: { type: "single_choice", points: 10, correctOptionId: "4" }, answerJson: "4", autoScore: 10, manualScore: null },
    ]);
    expect(items).toHaveLength(1);
    const i = items[0]!;
    expect(i.isCorrect).toBe(true);
    expect(i.score).toBe(10);
    expect(i.correctAnswer).toBe("4");
    expect(i.explanation).toBe("2 + 2 = 4.");
    expect(i.needsManualGrade).toBe(false);
  });

  it("single_choice incorrect", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-2", type: "single_choice", gradingJson: { type: "single_choice", points: 10, correctOptionId: "4" }, answerJson: "3", autoScore: 0, manualScore: null },
    ]);
    const i = items[0]!;
    expect(i.isCorrect).toBe(false);
    expect(i.score).toBe(0);
    expect(i.correctAnswer).toBe("4");
  });

  it("multiple_choice correct", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-3", type: "multiple_choice", gradingJson: { type: "multiple_choice", points: 10, correctOptionIds: ["4", "5"] }, answerJson: ["4", "5"], autoScore: 10, manualScore: null },
    ]);
    const i = items[0]!;
    expect(i.isCorrect).toBe(true);
    expect(i.correctAnswer).toBe("4, 5");
  });

  it("numeric_tolerance correct", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-4", type: "numeric_tolerance", gradingJson: { type: "numeric_tolerance", points: 10, expected: 9.8, toleranceAbsolute: 0.1 }, answerJson: 9.8, autoScore: 10, manualScore: null },
    ]);
    const i = items[0]!;
    expect(i.isCorrect).toBe(true);
    expect(i.correctAnswer).toBe("9.8");
  });

  it("short_text with accepted answers", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-5", type: "short_text", gradingJson: { type: "short_text", points: 10, acceptedAnswers: ["photosynthesis", "PhotoSynthesis"] }, answerJson: "photosynthesis", autoScore: 10, manualScore: null },
    ]);
    const i = items[0]!;
    expect(i.isCorrect).toBe(true);
    expect(i.correctAnswer).toBe("photosynthesis / PhotoSynthesis");
  });

  it("essay_manual = needsManualGrade", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-6", type: "essay_manual", gradingJson: { type: "essay_manual", points: 10 }, answerJson: "My essay answer", autoScore: 0, manualScore: null },
    ]);
    const i = items[0]!;
    expect(i.needsManualGrade).toBe(true);
    expect(i.isCorrect).toBe(false);
    expect(i.correctAnswer).toBeNull();
  });

  it("essay_manual with manual score = not needsManualGrade", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-7", type: "essay_manual", gradingJson: { type: "essay_manual", points: 10 }, answerJson: "My essay", autoScore: 0, manualScore: 8 },
    ]);
    const i = items[0]!;
    expect(i.needsManualGrade).toBe(false);
    expect(i.score).toBe(8);
  });

  it("explanation from .note fallback", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-8", type: "single_choice", gradingJson: { type: "single_choice", points: 10, correctOptionId: "4" }, answerJson: "3", autoScore: 0, manualScore: null, explanationJson: { note: "Teacher note: try again" } },
    ]);
    expect(items[0]!.explanation).toBe("Teacher note: try again");
  });

  it("no explanation returns null", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-9", type: "single_choice", gradingJson: { type: "single_choice", points: 10, correctOptionId: "4" }, answerJson: "3", autoScore: 0, manualScore: null, explanationJson: {} },
    ]);
    expect(items[0]!.explanation).toBeNull();
  });

  it("empty answer is not correct", () => {
    const items = buildQuizFeedback([
      { ...base, questionVersionId: "qv-10", type: "single_choice", gradingJson: { type: "single_choice", points: 10, correctOptionId: "4" }, answerJson: null, autoScore: 0, manualScore: null },
    ]);
    const i = items[0]!;
    expect(i.isCorrect).toBe(false);
    expect(i.score).toBe(0);
  });

  it("deterministic output for same input", () => {
    const input = [
      { ...base, questionVersionId: "qv-11", type: "single_choice" as const, gradingJson: { type: "single_choice" as const, points: 10, correctOptionId: "4" }, answerJson: "4", autoScore: 10, manualScore: null },
    ];
    expect(buildQuizFeedback(input)).toEqual(buildQuizFeedback(input));
  });
});
