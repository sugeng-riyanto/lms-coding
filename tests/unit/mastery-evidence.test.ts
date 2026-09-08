import { describe, expect, it } from "vitest";
import { bestAttemptScore, buildMasteryEvidence, type MasteryEvidenceInput } from "@/lib/mastery-evidence";

const BASE: MasteryEvidenceInput = {
  competencies: [
    { id: "c1", code: "PY-BASIC", title: "Python basic" },
    { id: "c2", code: "PY-FUNC", title: "Functions" },
  ],
  activityCompetencies: [
    { activity_id: "act1", competency_id: "c1", weight: 1 },
    { activity_id: "act2", competency_id: "c1", weight: 1 },
    { activity_id: "act2", competency_id: "c2", weight: 2 },
  ],
  activities: [
    { id: "act1", title: "Quiz 1", type: "quiz" },
    { id: "act2", title: "Project", type: "assignment_upload" },
  ],
  assessments: [
    { id: "as1", activity_id: "act1" },
    { id: "as2", activity_id: "act2" },
  ],
  attempts: [],
  responses: [],
  questionVersions: [],
  rubrics: [],
  rubricCriteria: [],
  criterionScores: [],
  revisions: [],
};

const attempt = (
  id: string,
  assessmentId: string,
  no: number,
  status: string,
  finalScore: number | null,
  submittedAt: string,
) => ({
  id,
  assessment_id: assessmentId,
  attempt_no: no,
  status,
  final_score: finalScore,
  submitted_at: submittedAt,
});

describe("bestAttemptScore", () => {
  it("final_score tertinggi di antara attempt submitted", () => {
    expect(
      bestAttemptScore([
        attempt("a1", "as1", 1, "submitted", 50, "t1"),
        attempt("a2", "as1", 2, "submitted", 90, "t2"),
      ]),
    ).toBe(90);
  });

  it("attempt in_progress / final_score null tidak dihitung", () => {
    expect(
      bestAttemptScore([
        attempt("a1", "as1", 1, "in_progress", null, "t1"),
        attempt("a2", "as1", 2, "submitted", null, "t2"),
      ]),
    ).toBeNull();
  });
});

describe("buildMasteryEvidence — mastery dari attempt nyata (bobot activity_competencies)", () => {
  it("mastery = Σ(weight×best)/Σ(weight) — evidence dua assessment", () => {
    const out = buildMasteryEvidence({
      ...BASE,
      attempts: [
        attempt("a1", "as1", 1, "submitted", 80, "t1"),
        attempt("a2", "as2", 1, "submitted", 60, "t2"),
      ],
    });
    const c1 = out.find((c) => c.competencyId === "c1")!;
    expect(c1.mastery).toBeCloseTo(0.7, 5);
    expect(c1.hasEvidence).toBe(true);
    expect(c1.assessments).toHaveLength(2);
    expect(c1.assessments[0]?.bestScore).toBe(80);
    expect(c1.assessments[1]?.bestScore).toBe(60);
  });

  it("percobaan terbaik menang pada assessment yang sama", () => {
    const out = buildMasteryEvidence({
      ...BASE,
      attempts: [
        attempt("a1", "as1", 1, "submitted", 50, "t1"),
        attempt("a2", "as1", 2, "submitted", 95, "t2"),
      ],
    });
    const c1 = out.find((c) => c.competencyId === "c1")!;
    // as2 (act2) belum ada attempt bernilai → tidak menurunkan mastery; hanya as1 dihitung.
    expect(c1.mastery).toBeCloseTo(0.95, 5);
    expect(c1.assessments.find((a) => a.assessmentId === "as1")?.bestScore).toBe(95);
    expect(c1.assessments.find((a) => a.assessmentId === "as2")?.bestScore).toBeNull();
  });

  it("tanpa attempt bernilai → mastery 0 dan hasEvidence=false (bukan lulus diam-diam)", () => {
    const out = buildMasteryEvidence({
      ...BASE,
      attempts: [attempt("a1", "as1", 1, "in_progress", null, "t1")],
    });
    const c1 = out.find((c) => c.competencyId === "c1")!;
    expect(c1.mastery).toBe(0);
    expect(c1.hasEvidence).toBe(false);
  });

  it("kompetensi tanpa aktivitas terhubung → kosong, bukan error", () => {
    const out = buildMasteryEvidence({ ...BASE, activityCompetencies: [] });
    expect(out).toHaveLength(2);
    expect(out.every((c) => c.mastery === 0 && c.assessments.length === 0)).toBe(true);
  });
});

describe("lintasan evidence — revisions & rubrik", () => {
  it("grade_revisions disertakan per attempt, terurut naik, actor disingkat", () => {
    const out = buildMasteryEvidence({
      ...BASE,
      attempts: [attempt("a1", "as1", 1, "submitted", 70, "t1")],
      revisions: [
        {
          attempt_id: "a1",
          previous_score: 40,
          new_score: 70,
          reason: "manual grade",
          changed_by: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          created_at: "t2",
        },
        {
          attempt_id: "a1",
          previous_score: null,
          new_score: 40,
          reason: "rubric finalized",
          changed_by: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          created_at: "t1",
        },
      ],
    });
    const revisions = out.find((c) => c.competencyId === "c1")!.assessments[0]!.attempts[0]!.revisions;
    expect(revisions).toHaveLength(2);
    expect(revisions[0]?.reason).toBe("rubric finalized");
    expect(revisions[1]?.reason).toBe("manual grade");
    expect(revisions[1]?.prev).toBe(40);
    expect(revisions[1]?.next).toBe(70);
    expect(revisions[0]?.by).toBe("aaaaaaaa");
  });

  it("rubrik + kriteria versi final (draft=false) tampil sebagai evidence", () => {
    const out = buildMasteryEvidence({
      ...BASE,
      attempts: [attempt("a1", "as1", 1, "submitted", 66, "t1")],
      responses: [
        { id: "r1", attempt_id: "a1", question_version_id: "qv1", auto_score: null, manual_score: 66 },
      ],
      questionVersions: [{ id: "qv1", version: 3, rubric_id: "rub1" }],
      rubrics: [{ id: "rub1", title: "Project rubric", version: 2 }],
      rubricCriteria: [
        { id: "cr1", rubric_id: "rub1", version: 2, title: "Correctness", max_points: 4 },
        { id: "cr2", rubric_id: "rub1", version: 1, title: "Old criterion", max_points: 2 },
      ],
      criterionScores: [
        { id: "s1", response_id: "r1", criterion_id: "cr1", score: 3, draft: false },
        { id: "s2", response_id: "r1", criterion_id: "cr2", score: 2, draft: true }, // draft diabaikan
      ],
    });
    const rubric = out.find((c) => c.competencyId === "c1")!.assessments[0]!.attempts[0]!.rubric!;
    expect(rubric.title).toBe("Project rubric");
    expect(rubric.version).toBe(2);
    expect(rubric.criteria).toHaveLength(1);
    expect(rubric.criteria[0]).toMatchObject({ title: "Correctness", maxPoints: 4, score: 3 });
  });

  it("attempt tanpa rubrik → rubric null, tidak crash", () => {
    const out = buildMasteryEvidence({
      ...BASE,
      attempts: [attempt("a1", "as1", 1, "submitted", 100, "t1")],
      responses: [
        { id: "r1", attempt_id: "a1", question_version_id: "qv1", auto_score: 100, manual_score: null },
      ],
      questionVersions: [{ id: "qv1", version: 1, rubric_id: null }],
    });
    expect(out.find((c) => c.competencyId === "c1")!.assessments[0]!.attempts[0]!.rubric).toBeNull();
  });
});
