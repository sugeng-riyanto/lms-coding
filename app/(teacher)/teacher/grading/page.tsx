import { createClient } from "@/lib/supabase/server";
import { GradeQueue } from "./grade-queue";

export const dynamic = "force-dynamic";

export interface QueueItem {
  responseId: string;
  attemptId: string;
  attemptNo: number;
  attemptStatus: string;
  studentName: string;
  promptText: string;
  qtype: string;
  answer: unknown;
  autoScore: number | null;
  manualScore: number | null;
  revisions: { previous: number | null; new: number | null; reason: string; at: string }[];
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
  for (const a of mine) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", a.enrollments?.student_id ?? "")
      .single();
    const { data: responses } = await supabase
      .from("responses")
      .select(
        "id,question_version_id,answer_json,auto_score,manual_score,question_versions(question_id,questions(type,prompt_json))",
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
      out.push({
        responseId: r.id,
        attemptId: a.id,
        attemptNo: a.attempt_no,
        attemptStatus: a.status,
        studentName: (prof as { display_name: string } | null)?.display_name ?? "—",
        promptText: r.question_versions?.questions?.prompt_json.text ?? "?",
        qtype,
        answer: r.answer_json,
        autoScore: r.auto_score,
        manualScore: r.manual_score,
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
  return out;
}

export default async function GradingPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub ?? "";
  let items: QueueItem[] = [];
  try {
    items = await getQueue(userId);
  } catch {
    items = [];
  }
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Antrian penilaian manual</h1>
      <p className="mt-1 text-sm text-slate-600">
        Esai & proyek. Perubahan nilai tercatat sebagai revisi + audit.
      </p>
      <GradeQueue initialItems={items} />
    </main>
  );
}
