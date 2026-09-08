import type { GradingRule, NumericUnitRule, QuestionType } from "@/lib/grading";
import type { QuestionMediaSpec } from "@/lib/content-blocks";

/** Parse "kg:1,g:0.001" + unit basis menjadi NumericUnitRule (atau undefined). */
export function parseUnitRule(factorsCsv: string, expectedUnit: string): NumericUnitRule | undefined {
  const unitFactors: Record<string, number> = {};
  for (const pair of factorsCsv.split(",")) {
    const [rawU, rawF] = pair.split(":").map((s) => s.trim());
    if (!rawU) continue;
    const f = Number(rawF);
    if (!Number.isFinite(f) || f <= 0) continue;
    unitFactors[rawU.toLowerCase()] = f;
  }
  if (Object.keys(unitFactors).length === 0) return undefined;
  return { expectedUnit: expectedUnit.trim() || "unit", unitFactors };
}

/** Soal yang boleh dikirim ke browser: tanpa grading_json & explanation. */
export interface SanitizedQuestion {
  questionVersionId: string;
  position: number;
  points: number;
  type: QuestionType;
  promptText: string;
  options: string[];
  /** Media embed pada butir soal (sudah disanitasi server saat authoring). */
  media: QuestionMediaSpec | null;
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
  promptJson: { text?: string; options?: string[]; media?: unknown };
}): SanitizedQuestion {
  return {
    questionVersionId: input.questionVersionId,
    position: input.position,
    points: input.points,
    type: input.type,
    promptText: input.promptJson.text ?? "",
    options: input.promptJson.options ?? [],
    media: input.promptJson.media ? (input.promptJson.media as QuestionMediaSpec) : null,
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
        partialCredit: fields["partial"] === "fractional" ? "fractional" : "exact",
      };
    case "true_false":
      return { ...base, correctOptionId: fields["correct"] === "false" ? "false" : "true" };
    case "numeric_tolerance":
      return {
        ...base,
        expected: Number(fields["expected"] ?? "0"),
        toleranceAbsolute: Number(fields["tolAbs"] ?? "0"),
        toleranceRelative: Number(fields["tolRel"] ?? "0"),
        // unitFactors: "kg:1,g:0.001,mg:0.000001" -> konversi ke basis (expectedUnit).
        unit: parseUnitRule(fields["unitFactors"] ?? "", fields["unitExpected"] ?? ""),
      };
    case "short_text":
      return {
        ...base,
        acceptedAnswers: (fields["accepted"] ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        // normalize=unicode → NFKC + lipat apostrof/kutip (English/Mandarin IME);
        // default (atau "plain") → back-compat tanpa transform unicode.
        normalize:
          fields["normalize"] === "unicode"
            ? { unicode: true }
            : fields["normalize"] === "plain"
              ? { unicode: false }
              : undefined,
      };
    case "essay_manual":
    case "file_manual":
      return { ...base };
  }
}
