export interface CompetencyEvidence {
  competencyId: string;
  earned: number;
  possible: number;
  weight: number;
  critical: boolean;
}

export function competencyMastery(evidences: CompetencyEvidence[]): Map<string, number> {
  const byComp = new Map<string, { earned: number; possible: number }>();
  for (const e of evidences) {
    const cur = byComp.get(e.competencyId) ?? { earned: 0, possible: 0 };
    cur.earned += e.earned * e.weight;
    cur.possible += e.possible * e.weight;
    byComp.set(e.competencyId, cur);
  }
  const out = new Map<string, number>();
  for (const [id, v] of byComp) {
    out.set(id, v.possible <= 0 ? 0 : Math.min(1, Math.max(0, v.earned / v.possible)));
  }
  return out;
}

export interface LevelRule {
  passingScore: number; // 0-100
  masteryThreshold: number; // 0-1
  criticalCompetencies: string[];
  weights: { formative: number; summative: number; project: number };
}

export function validateWeights(w: LevelRule["weights"]): boolean {
  const sum = w.formative + w.summative + w.project;
  return Math.abs(sum - 100) < 1e-9 && w.formative >= 0 && w.summative >= 0 && w.project >= 0;
}

export interface LevelCompletionInput {
  requiredActivitiesCompleted: boolean;
  summativePassed: boolean;
  levelPercent: number;
  mastery: Map<string, number>;
  rule: LevelRule;
}

export function evaluateLevelCompletion(input: LevelCompletionInput): {
  completed: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!input.requiredActivitiesCompleted) reasons.push("Ada aktivitas wajib yang belum selesai.");
  if (input.levelPercent < input.rule.passingScore)
    reasons.push(
      `Nilai level ${input.levelPercent.toFixed(1)} di bawah passing score ${input.rule.passingScore}.`,
    );
  for (const comp of input.rule.criticalCompetencies) {
    const m = input.mastery.get(comp) ?? 0;
    if (m < input.rule.masteryThreshold)
      reasons.push(
        `Kompetensi kritis ${comp} mastery ${m.toFixed(2)} di bawah ${input.rule.masteryThreshold}.`,
      );
  }
  if (!input.summativePassed) reasons.push("Asesmen summative belum passed.");
  return { completed: reasons.length === 0, reasons };
}
