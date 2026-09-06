export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "numeric_tolerance"
  | "short_text"
  | "essay_manual"
  | "file_manual";

export interface GradingRule {
  type: QuestionType;
  points: number;
  // single_choice / true_false
  correctOptionId?: string;
  // multiple_choice
  correctOptionIds?: string[];
  // numeric
  expected?: number;
  toleranceAbsolute?: number;
  toleranceRelative?: number;
  // short_text
  acceptedAnswers?: string[];
  normalize?: { trim?: boolean; lowercase?: boolean; collapseSpaces?: boolean };
}

export function normalizeShortText(input: string, rule?: GradingRule["normalize"]): string {
  let s = input;
  if (rule?.trim !== false) s = s.trim();
  if (rule?.collapseSpaces !== false) s = s.replace(/\s+/g, " ");
  if (rule?.lowercase !== false) s = s.toLowerCase();
  return s;
}

/** Auto-grade pertanyaan objektif. Essay/file → selalu 0 (masuk moderation queue). */
export function autoGrade(rule: GradingRule, answer: unknown): number {
  const points = Math.max(0, rule.points);
  switch (rule.type) {
    case "single_choice":
    case "true_false": {
      if (typeof answer !== "string") return 0;
      return answer === rule.correctOptionId ? points : 0;
    }
    case "multiple_choice": {
      if (!Array.isArray(answer)) return 0;
      const expected = new Set(rule.correctOptionIds ?? []);
      const got = new Set(answer.filter((a): a is string => typeof a === "string"));
      if (got.size !== expected.size) return 0;
      for (const id of got) if (!expected.has(id)) return 0;
      return points;
    }
    case "numeric_tolerance": {
      const n = typeof answer === "number" ? answer : Number(answer);
      if (!Number.isFinite(n) || rule.expected === undefined) return 0;
      const absTol = rule.toleranceAbsolute ?? 0;
      const relTol = (rule.toleranceRelative ?? 0) * Math.abs(rule.expected);
      const tol = Math.max(absTol, relTol);
      return Math.abs(n - rule.expected) <= tol ? points : 0;
    }
    case "short_text": {
      if (typeof answer !== "string") return 0;
      const accepted = rule.acceptedAnswers ?? [];
      if (accepted.length === 0) return 0; // tanpa rule eksplisit → manual
      const normAnswer = normalizeShortText(answer, rule.normalize);
      return accepted.some((a) => normalizeShortText(a, rule.normalize) === normAnswer) ? points : 0;
    }
    case "essay_manual":
    case "file_manual":
      return 0;
  }
}

export function questionScore(autoScore: number, manualScore: number | null, points: number): number {
  return Math.min(Math.max(autoScore + (manualScore ?? 0), 0), Math.max(0, points));
}

export function assessmentPercent(scores: number[], points: number[]): number {
  const total = points.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const earned = scores.reduce((a, b) => a + b, 0);
  return Math.min(100, Math.max(0, (earned / total) * 100));
}
