import { evaluateLevelCompletion, type LevelRule } from "@/lib/mastery";

/** Input eligibility dari snapshots + attempts (dikumpulkan Server Action). */
export interface EligibilityInput {
  requiredLessonIds: string[];
  completedLessonIds: string[];
  levelPercent: number;
  summativePassed: boolean;
  mastery: Map<string, number>;
  rule: LevelRule;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/** Evaluator server-side: browser tidak menentukan kelayakan sertifikat. */
export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const completed = new Set(input.completedLessonIds);
  const missing = input.requiredLessonIds.filter((id) => !completed.has(id));
  const reasons: string[] = [];
  if (missing.length > 0) reasons.push(`${missing.length} lesson wajib belum selesai.`);
  const base = evaluateLevelCompletion({
    requiredActivitiesCompleted: missing.length === 0,
    summativePassed: input.summativePassed,
    levelPercent: input.levelPercent,
    mastery: input.mastery,
    rule: input.rule,
  });
  reasons.push(...base.reasons);
  return { eligible: reasons.length === 0, reasons };
}
