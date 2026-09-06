import type { GradingRule, QuestionType } from "@/lib/grading";

/** Soal yang boleh dikirim ke browser: tanpa grading_json & explanation. */
export interface SanitizedQuestion {
  questionVersionId: string;
  position: number;
  points: number;
  type: QuestionType;
  promptText: string;
  options: string[];
}

/**
 * Sanitasi satu butir untuk attempt: kunci jawaban & explanation TIDAK ikut.
 * Prompt & opsi berasal dari questions.prompt_json (kolom grading terpisah).
 */
export function sanitizeQuestionForAttempt(input: {
  questionVersionId: string;
  position: number;
  points: number;
  type: QuestionType;
  promptJson: { text?: string; options?: string[] };
}): SanitizedQuestion {
  return {
    questionVersionId: input.questionVersionId,
    position: input.position,
    points: input.points,
    type: input.type,
    promptText: input.promptJson.text ?? "",
    options: input.promptJson.options ?? [],
  };
}

/** Nilai boleh ditampilkan ke murid hanya bila release=immediate atau attempt finalized. */
export function canShowScore(release: string, attemptStatus: string): boolean {
  if (release === "immediate") return attemptStatus !== "in_progress";
  return attemptStatus === "finalized";
}

/** Bangun grading_json dari field form builder (server memvalidasi ulang). */
export function buildGradingRule(
  type: QuestionType,
  points: number,
  fields: Record<string, string>,
): GradingRule {
  const base = { type, points };
  switch (type) {
    case "single_choice":
      return { ...base, correctOptionId: fields["correct"] ?? "" };
    case "multiple_choice":
      return {
        ...base,
        correctOptionIds: (fields["corrects"] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    case "true_false":
      return { ...base, correctOptionId: fields["correct"] === "false" ? "false" : "true" };
    case "numeric_tolerance":
      return {
        ...base,
        expected: Number(fields["expected"] ?? "0"),
        toleranceAbsolute: Number(fields["tolAbs"] ?? "0"),
        toleranceRelative: Number(fields["tolRel"] ?? "0"),
      };
    case "short_text":
      return {
        ...base,
        acceptedAnswers: (fields["accepted"] ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    case "essay_manual":
    case "file_manual":
      return { ...base };
  }
}
