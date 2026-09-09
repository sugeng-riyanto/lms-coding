import type { GradingRule, QuestionType } from "@/lib/grading";
import { autoGrade } from "@/lib/grading";

export interface QuizFeedbackItem {
  questionVersionId: string;
  position: number;
  points: number;
  type: QuestionType;
  promptText: string;
  options: string[];
  answer: unknown;
  isCorrect: boolean;
  score: number;
  correctAnswer: string | null;
  explanation: string | null;
  needsManualGrade: boolean;
}

/**
 * Build per-question feedback from raw data. Pure function — no I/O.
 *
 * - auto-graded questions: shows correct answer + explanation
 * - essay/file: shows "needs manual grade" + teacher feedback (if any)
 * - explanation comes from questions.explanation_json.text or .note
 */
export function buildQuizFeedback(rows: {
  questionVersionId: string;
  position: number;
  points: number;
  type: QuestionType;
  promptJson: { text?: string; options?: string[] };
  gradingJson: GradingRule;
  explanationJson: Record<string, unknown>;
  answerJson: unknown;
  autoScore: number | null;
  manualScore: number | null;
  feedbackJson: Record<string, unknown>;
}[]): QuizFeedbackItem[] {
  return rows.map((r) => {
    const rule = { ...r.gradingJson, points: r.points };
    const autoScore = autoGrade(rule, r.answerJson);
    const score = r.manualScore !== null ? autoScore + r.manualScore : autoScore;
    const isCorrect = score >= r.points && r.points > 0;
    const needsManual = r.type === "essay_manual" || r.type === "file_manual";

    return {
      questionVersionId: r.questionVersionId,
      position: r.position,
      points: r.points,
      type: r.type,
      promptText: r.promptJson.text ?? "",
      options: r.promptJson.options ?? [],
      answer: r.answerJson,
      isCorrect,
      score,
      correctAnswer: extractCorrectAnswer(r.type, rule),
      explanation: extractExplanation(r.explanationJson),
      needsManualGrade: needsManual && r.manualScore === null,
    };
  });
}

function extractCorrectAnswer(type: QuestionType, rule: GradingRule): string | null {
  switch (type) {
    case "single_choice":
    case "true_false":
      return rule.correctOptionId ?? null;
    case "multiple_choice":
      return (rule.correctOptionIds ?? []).join(", ") || null;
    case "numeric_tolerance":
      return rule.expected !== undefined
        ? `${rule.expected}${rule.unit ? " " + rule.unit.expectedUnit : ""}`
        : null;
    case "short_text":
      return (rule.acceptedAnswers ?? []).join(" / ") || null;
    case "essay_manual":
    case "file_manual":
      return null;
  }
}

function extractExplanation(json: Record<string, unknown>): string | null {
  if (typeof json.text === "string" && json.text.trim()) return json.text.trim();
  if (typeof json.note === "string" && json.note.trim()) return json.note.trim();
  return null;
}
