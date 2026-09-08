/**
 * Competency mastery → evidence trail (AC-53).
 *
 * Murni & bebas DB: pemanggil (halaman server, di bawah RLS) memasok seluruh
 * baris yang sudah difetch; fungsi ini menghitung mastery per kompetensi dari
 * ATTEMPT nyata (bukan perkiraan), lalu membangun lintasan evidence per
 * kompetensi: assessment → attempt → grade_revisions → rubrik + skor kriteria
 * (versi rubrik yang dipakai saat finalize).
 *
 * Mastery per kompetensi didefinisikan eksplisit dan dapat diaudit:
 *   Σ(weight × bestScore) / Σ(weight × 100)
 * dengan bestScore = final_score TERTINGGI di antara attempt submitted pada
 * tiap assessment aktivitas yang terhubung ke kompetensi itu (bobot dari
 * activity_competencies). Tanpa attempt dengan nilai → mastery 0 + flag
 * hasEvidence=false (bukan "lulus diam-diam").
 */

export interface CompetencyRow {
  id: string;
  code: string;
  title: string;
}

export interface ActivityCompetencyRow {
  activity_id: string;
  competency_id: string;
  weight: number;
}

export interface ActivityRow {
  id: string;
  title: string;
  type: string | null;
}

export interface AssessmentRow {
  id: string;
  activity_id: string;
}

export interface AttemptRow {
  id: string;
  assessment_id: string;
  attempt_no: number;
  status: string;
  final_score: number | null;
  submitted_at: string | null;
}

export interface ResponseRow {
  id: string;
  attempt_id: string;
  question_version_id: string | null;
  auto_score: number | null;
  manual_score: number | null;
}

export interface QuestionVersionRow {
  id: string;
  version: number;
  rubric_id: string | null;
}

export interface RubricRow {
  id: string;
  title: string;
  version: number;
}

export interface RubricCriterionRow {
  id: string;
  rubric_id: string;
  version: number;
  title: string;
  max_points: number;
}

export interface CriterionScoreRow {
  id: string;
  response_id: string;
  criterion_id: string;
  score: number;
  draft: boolean;
}

export interface RevisionRow {
  attempt_id: string;
  previous_score: number | null;
  new_score: number | null;
  reason: string;
  changed_by: string;
  created_at: string;
}

export interface MasteryEvidenceInput {
  competencies: CompetencyRow[];
  activityCompetencies: ActivityCompetencyRow[];
  activities: ActivityRow[];
  assessments: AssessmentRow[];
  attempts: AttemptRow[];
  responses: ResponseRow[];
  questionVersions: QuestionVersionRow[];
  rubrics: RubricRow[];
  rubricCriteria: RubricCriterionRow[];
  criterionScores: CriterionScoreRow[];
  revisions: RevisionRow[];
}

export interface RevisionEvidence {
  prev: number | null;
  next: number | null;
  reason: string;
  by: string;
  at: string;
}

export interface RubricEvidence {
  title: string;
  version: number;
  criteria: { title: string; maxPoints: number; score: number }[];
}

export interface AttemptEvidence {
  attemptId: string;
  attemptNo: number;
  status: string;
  finalScore: number | null;
  submittedAt: string | null;
  revisions: RevisionEvidence[];
  rubric: RubricEvidence | null;
}

export interface AssessmentEvidence {
  assessmentId: string;
  activityId: string;
  activityTitle: string;
  bestScore: number | null;
  attempts: AttemptEvidence[];
}

export interface CompetencyEvidenceOut {
  competencyId: string;
  code: string;
  title: string;
  mastery: number;
  hasEvidence: boolean;
  assessments: AssessmentEvidence[];
}

const byId = <T extends { id: string }>(rows: T[]): Map<string, T> => new Map(rows.map((r) => [r.id, r]));

/** Nilai final attempt terbaik di antara attempt submitted (ignore in_progress). */
export function bestAttemptScore(attempts: AttemptRow[]): number | null {
  const scores = attempts
    .filter((a) => a.status === "submitted" && typeof a.final_score === "number")
    .map((a) => a.final_score as number);
  return scores.length === 0 ? null : Math.max(...scores);
}

export function buildMasteryEvidence(input: MasteryEvidenceInput): CompetencyEvidenceOut[] {
  const activityById = byId(input.activities);
  const qvById = byId(input.questionVersions);
  const rubricById = byId(input.rubrics);

  // activity_id → competency rows (bobot).
  const compsByActivity = new Map<string, ActivityCompetencyRow[]>();
  for (const ac of input.activityCompetencies) {
    const list = compsByActivity.get(ac.activity_id) ?? [];
    list.push(ac);
    compsByActivity.set(ac.activity_id, list);
  }

  // activity_id → assessments.
  const assessmentsByActivity = new Map<string, AssessmentRow[]>();
  for (const a of input.assessments) {
    const list = assessmentsByActivity.get(a.activity_id) ?? [];
    list.push(a);
    assessmentsByActivity.set(a.activity_id, list);
  }

  // attempt_id → attempts.
  const attemptsByAssessment = new Map<string, AttemptRow[]>();
  for (const t of input.attempts) {
    const list = attemptsByAssessment.get(t.assessment_id) ?? [];
    list.push(t);
    attemptsByAssessment.set(t.assessment_id, list);
  }

  // Rubrik per attempt: dari response → question_version → rubric; kriteria dari
  // criterion_scores final (draft=false) pada response attempt itu.
  const responsesByAttempt = new Map<string, ResponseRow[]>();
  for (const r of input.responses) {
    const list = responsesByAttempt.get(r.attempt_id) ?? [];
    list.push(r);
    responsesByAttempt.set(r.attempt_id, list);
  }
  const criteriaById = byId(input.rubricCriteria);
  const scoresByResponse = new Map<string, CriterionScoreRow[]>();
  for (const s of input.criterionScores) {
    if (s.draft) continue; // hanya nilai final = evidence terpakai
    const list = scoresByResponse.get(s.response_id) ?? [];
    list.push(s);
    scoresByResponse.set(s.response_id, list);
  }
  const revisionsByAttempt = new Map<string, RevisionRow[]>();
  for (const r of input.revisions) {
    const list = revisionsByAttempt.get(r.attempt_id) ?? [];
    list.push(r);
    revisionsByAttempt.set(r.attempt_id, list);
  }

  const rubricForAttempt = (attemptId: string): RubricEvidence | null => {
    const responses = responsesByAttempt.get(attemptId) ?? [];
    for (const res of responses) {
      if (!res.question_version_id) continue;
      const qv = qvById.get(res.question_version_id);
      if (!qv?.rubric_id) continue;
      const rubric = rubricById.get(qv.rubric_id);
      if (!rubric) continue;
      const criteria = (scoresByResponse.get(res.id) ?? [])
        .map((s) => {
          const c = criteriaById.get(s.criterion_id);
          return c ? { title: c.title, maxPoints: c.max_points, score: s.score } : null;
        })
        .filter((c): c is { title: string; maxPoints: number; score: number } => Boolean(c));
      return { title: rubric.title, version: rubric.version, criteria };
    }
    return null;
  };

  const revisionsFor = (attemptId: string): RevisionEvidence[] =>
    (revisionsByAttempt.get(attemptId) ?? [])
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
      .map((r) => ({
        prev: r.previous_score,
        next: r.new_score,
        reason: r.reason,
        by: r.changed_by.slice(0, 8),
        at: r.created_at,
      }));

  const out: CompetencyEvidenceOut[] = [];
  for (const comp of input.competencies) {
    const compRows = input.activityCompetencies.filter((ac) => ac.competency_id === comp.id);
    const linkedActivities = [...new Set(compRows.map((ac) => ac.activity_id))];
    const assessments: AssessmentEvidence[] = [];
    let weightedEarned = 0;
    let weightedPossible = 0;

    for (const activityId of linkedActivities) {
      const activity = activityById.get(activityId);
      const weight = compRows.find((ac) => ac.activity_id === activityId)?.weight ?? 0;
      const asmtList = assessmentsByActivity.get(activityId) ?? [];
      for (const asmt of asmtList) {
        const attempts = (attemptsByAssessment.get(asmt.id) ?? [])
          .slice()
          .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
        const best = bestAttemptScore(attempts);
        if (best !== null) {
          weightedEarned += weight * (best / 100);
          weightedPossible += weight;
        }
        assessments.push({
          assessmentId: asmt.id,
          activityId,
          activityTitle: activity?.title ?? activityId,
          bestScore: best,
          attempts: attempts.map((t) => ({
            attemptId: t.id,
            attemptNo: t.attempt_no,
            status: t.status,
            finalScore: t.final_score,
            submittedAt: t.submitted_at,
            revisions: revisionsFor(t.id),
            rubric: rubricForAttempt(t.id),
          })),
        });
      }
    }

    const mastery = weightedPossible > 0 ? weightedEarned / weightedPossible : 0;
    const hasEvidence = assessments.some((a) => a.bestScore !== null);
    out.push({
      competencyId: comp.id,
      code: comp.code,
      title: comp.title,
      mastery,
      hasEvidence,
      assessments,
    });
  }
  return out;
}
