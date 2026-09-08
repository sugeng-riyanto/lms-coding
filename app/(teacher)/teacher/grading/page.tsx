import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { getLang, mkT } from "@/lib/i18n";
import { GRADING } from "@/lib/ui-text/grading";
import { GradeQueue } from "./grade-queue";

export const dynamic = "force-dynamic";

export interface QueueRubricCriterion {
  criterionId: string;
  title: string;
  maxPoints: number;
  draft: boolean;
  score: number | null;
  feedback: string;
}

export interface QueueRubric {
  id: string;
  title: string;
  criteria: QueueRubricCriterion[];
}

export interface QueueItem {
  responseId: string;
  attemptId: string;
  questionVersionId: string;
  attemptNo: number;
  attemptStatus: string;
  studentName: string;
  promptText: string;
  qtype: string;
  answer: unknown;
  autoScore: number | null;
  manualScore: number | null;
  rubric: QueueRubric | null;
  revisions: { previous: number | null; new: number | null; reason: string; at: string }[];
  aiDraft: { id: string; body: string; model: string; status: string } | null;
}

export interface AiConfig {
  enabled: boolean;
  consent: boolean;
}

/** Moderation queue: jawaban essay/file yang butuh nilai manual (cohort guru). */
async function getQueue(userId: string): Promise<QueueItem[]> {
  const supabase = await createClient();
  const { data: cohorts } = await supabase.from("cohorts").select("id").eq("teacher_id", userId);
  const cohortIds = ((cohorts as { id: string }[] | null) ?? []).map((c) => c.id);
  if (cohortIds.length === 0) return [];
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id,attempt_no,status,created_at,enrollments(student_id,cohort_id)")
    .neq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(100);
  // RLS teacher policies sudah membatasi ke cohort sendiri; filter JS defensif.
  const mine = (
    (attempts as
      | {
          id: string;
          attempt_no: number;
          status: string;
          enrollments: { student_id: string; cohort_id: string } | null;
        }[]
      | null) ?? []
  ).filter((a) => a.enrollments && cohortIds.includes(a.enrollments.cohort_id));
  const out: QueueItem[] = [];
  const responseIds: string[] = [];
  for (const a of mine) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", a.enrollments?.student_id ?? "")
      .single();
    const { data: responses } = await supabase
      .from("responses")
      .select(
        "id,question_version_id,answer_json,auto_score,manual_score,question_versions(rubric_id,question_id,questions(type,prompt_json))",
      )
      .eq("attempt_id", a.id)
      .is("manual_score", null);
    for (const r of (responses as
      | {
          id: string;
          question_version_id: string;
          answer_json: unknown;
          auto_score: number | null;
          manual_score: number | null;
          question_versions: {
            question_id: string;
            questions: { type: string; prompt_json: { text?: string } } | null;
          } | null;
        }[]
      | null) ?? []) {
      const qtype = r.question_versions?.questions?.type ?? "";
      if (qtype !== "essay_manual" && qtype !== "file_manual") continue;
      const { data: revs } = await supabase
        .from("grade_revisions")
        .select("previous_score,new_score,reason,created_at")
        .eq("attempt_id", a.id)
        .order("created_at");
      // Rubrik penilaian (jika soal diikat): kriteria + skor draf yang sudah ada.
      const rubricId = (r.question_versions as { rubric_id: string | null } | null)?.rubric_id ?? null;
      let rubric: QueueRubric | null = null;
      if (rubricId) {
        const { data: rub } = await supabase
          .from("rubrics")
          .select("id,title,version")
          .eq("id", rubricId)
          .single();
        const currentVersion = (rub as { version: number } | null)?.version ?? 1;
        const { data: crits } = await supabase
          .from("rubric_criteria")
          .select("id,title,max_points")
          .eq("rubric_id", rubricId)
          .eq("version", currentVersion)
          .order("position");
        const { data: scores } = await supabase
          .from("criterion_scores")
          .select("criterion_id,score,feedback,draft")
          .eq("response_id", r.id);
        const scoreMap = new Map(
          (
            (scores as { criterion_id: string; score: number; feedback: string; draft: boolean }[] | null) ??
            []
          ).map((s) => [s.criterion_id, s]),
        );
        rubric = {
          id: (rub as { id: string } | null)?.id ?? rubricId,
          title: (rub as { title: string } | null)?.title ?? "Rubrik",
          criteria: ((crits as { id: string; title: string; max_points: number }[] | null) ?? []).map((c) => {
            const s = scoreMap.get(c.id);
            return {
              criterionId: c.id,
              title: c.title,
              maxPoints: Number(c.max_points),
              draft: s?.draft ?? true,
              score: s?.score ?? null,
              feedback: s?.feedback ?? "",
            };
          }),
        };
      }
      responseIds.push(r.id);
      out.push({
        responseId: r.id,
        attemptId: a.id,
        questionVersionId: r.question_version_id,
        attemptNo: a.attempt_no,
        attemptStatus: a.status,
        studentName: (prof as { display_name: string } | null)?.display_name ?? "—",
        promptText: r.question_versions?.questions?.prompt_json.text ?? "?",
        qtype,
        answer: r.answer_json,
        autoScore: r.auto_score,
        manualScore: r.manual_score,
        rubric,
        aiDraft: null,
        revisions: (
          (revs as
            | {
                previous_score: number | null;
                new_score: number | null;
                reason: string;
                created_at: string;
              }[]
            | null) ?? []
        ).map((x) => ({
          previous: x.previous_score,
          new: x.new_score,
          reason: x.reason,
          at: x.created_at,
        })),
      });
    }
  }
  // Draft AI per response (batch, tanpa N+1): tabel teacher-only (RLS).
  if (responseIds.length > 0) {
    const { data: drafts } = await supabase
      .from("ai_feedback_drafts")
      .select("id,response_id,body,model,status")
      .in("response_id", responseIds);
    const byResp = new Map(
      (
        (drafts as
          { id: string; response_id: string; body: string; model: string; status: string }[] | null) ?? []
      ).map((d) => [d.response_id, d]),
    );
    for (const item of out) {
      const d = byResp.get(item.responseId);
      if (d) item.aiDraft = { id: d.id, body: d.body, model: d.model, status: d.status };
    }
  }
  return out;
}

export default async function GradingPage() {
  const lang = await getLang();
  const t = mkT(GRADING, lang);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub ?? "";
  let items: QueueItem[] = [];
  try {
    items = await getQueue(userId);
  } catch {
    items = [];
  }

  // AI draft feedback: gerbang env + consent org (ADR-014; default OFF).
  let aiEnabled = false;
  try {
    aiEnabled = getServerEnv().AI_FEEDBACK_ENABLED;
  } catch {
    aiEnabled = false;
  }
  let aiConsent = false;
  const { data: mem } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "teacher")
    .eq("status", "active")
    .limit(1)
    .single();
  const orgId = (mem as { organization_id: string } | null)?.organization_id;
  if (orgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("ai_feedback_consent")
      .eq("id", orgId)
      .single();
    aiConsent = !!((org as { ai_feedback_consent: boolean } | null)?.ai_feedback_consent ?? false);
  }
  const aiConfig: AiConfig = { enabled: aiEnabled, consent: aiConsent };

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
      <GradeQueue initialItems={items} aiConfig={aiConfig} lang={lang} />
    </main>
  );
}
