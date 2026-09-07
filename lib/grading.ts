export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "numeric_tolerance"
  | "short_text"
  | "essay_manual"
  | "file_manual";

export interface NumericUnitRule {
  /** Unit jawaban yang diharapkan bila murid tidak menulis unit (basis konversi). */
  expectedUnit: string;
  /** Faktor konversi tiap unit ke basis: { kg: 1, g: 0.001, mg: 0.000001 }. */
  unitFactors: Record<string, number>;
}

export interface GradingRule {
  type: QuestionType;
  points: number;
  // single_choice / true_false
  correctOptionId?: string;
  // multiple_choice
  correctOptionIds?: string[];
  /** Kebijakan skor MC: "exact" = semua-or-tidak (default), "fractional" = proporsi benar. */
  partialCredit?: "exact" | "fractional";
  // numeric
  expected?: number;
  toleranceAbsolute?: number;
  toleranceRelative?: number;
  /** Normalisasi unit: jawaban "5000 g" dikonversi ke basis (expectedUnit) sebelum toleransi. */
  unit?: NumericUnitRule;
  // short_text
  acceptedAnswers?: string[];
  normalize?: {
    trim?: boolean;
    lowercase?: boolean;
    collapseSpaces?: boolean;
    /** NFKC + lipat apostrof/kutip (penting utk teks IME: Mandarin, bahasa lain). */
    unicode?: boolean;
  };
}

/**
 * Parse jawaban numerik + konversi unit ke basis. Mengembalikan null bila:
 * - bukan number/string numerik yang valid;
 * - string memuat unit yang TIDAK ada di unitFactors (tidak menebak);
 * - string memuat unit dan rule tidak mendefinisikan unitFactors.
 * Number polos dianggap sudah dalam basis (expectedUnit).
 */
export function parseNumericAnswer(answer: unknown, unit?: NumericUnitRule): number | null {
  if (typeof answer === "number") return Number.isFinite(answer) ? answer : null;
  if (typeof answer !== "string") return null;
  // Dukung notasi ilmiah (fisika/kimia/matematika): 6.022e23, 1e-9, 2.5E+3.
  const m = /^\s*(-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([A-Za-zµ%]+)?\s*$/.exec(answer);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  const token = m[2];
  if (!token) return value; // tanpa unit → basis
  if (!unit || !unit.unitFactors) return null;
  const factor = unit.unitFactors[token.toLowerCase()];
  if (factor === undefined) return null; // unit tak dikenal → gagal, jangan tebak
  return value * factor;
}

/** Lipat apostrof/kutip melengkung → lurus (dipakai saat `unicode: true`). */
function foldCurlyQuotes(s: string): string {
  return s.replace(/[\u2018\u2019\u02BC\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"');
}

export function normalizeShortText(input: string, rule?: GradingRule["normalize"]): string {
  let s = typeof input === "string" ? input : "";
  if (rule?.trim !== false) s = s.trim();
  if (rule?.unicode) s = foldCurlyQuotes(s.normalize("NFKC"));
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
      if (rule.partialCredit === "fractional") {
        // Kebijakan parsial: poin = poin × (opsi benar yang dipilih / total opsi benar).
        // Opsi salah yang ikut dipilih TIDAK mengurangi (tidak ada penalti negatif).
        if (expected.size === 0) return 0;
        let matched = 0;
        for (const id of got) if (expected.has(id)) matched++;
        return Math.min(points, (points * matched) / expected.size);
      }
      if (got.size !== expected.size) return 0;
      for (const id of got) if (!expected.has(id)) return 0;
      return points;
    }
    case "numeric_tolerance": {
      const n = parseNumericAnswer(answer, rule.unit);
      if (n === null || rule.expected === undefined) return 0;
      const absTol = rule.toleranceAbsolute ?? 0;
      const relTol = (rule.toleranceRelative ?? 0) * Math.abs(rule.expected);
      const tol = Math.max(absTol, relTol);
      // Batas inklusif: |n - expected| == tol → benar (boundary test).
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
