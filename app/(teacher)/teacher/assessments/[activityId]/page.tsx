import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssessmentBuilder } from "./assessment-builder";

export const dynamic = "force-dynamic";

async function getData(activityId: string) {
  const supabase = await createClient();
  const { data: act } = await supabase
    .from("activities")
    .select("id,title,type")
    .eq("id", activityId)
    .single();
  const activity = act as { id: string; title: string; type: string } | null;
  if (!activity) return null;
  const { data: asmt } = await supabase
    .from("assessments")
    .select("id,settings_json,total_points")
    .eq("activity_id", activityId)
    .limit(1)
    .single();
  const assessment = asmt as {
    id: string;
    settings_json: Record<string, unknown>;
    total_points: number;
  } | null;
  let linked: { question_version_id: string; position: number; points: number; promptText: string }[] = [];
  if (assessment) {
    const { data: links } = await supabase
      .from("assessment_questions")
      .select("question_version_id,position,points")
      .eq("assessment_id", assessment.id)
      .order("position");
    for (const link of (links as
      { question_version_id: string; position: number; points: number }[] | null) ?? []) {
      const { data: qv } = await supabase
        .from("question_versions")
        .select("question_id")
        .eq("id", link.question_version_id)
        .single();
      const qid = (qv as { question_id: string } | null)?.question_id;
      const { data: q } = qid
        ? await supabase.from("questions").select("prompt_json").eq("id", qid).single()
        : { data: null };
      linked.push({
        ...link,
        promptText: (q as { prompt_json: { text?: string } } | null)?.prompt_json.text ?? "?",
      });
    }
  }
  // Bank versi untuk dropdown tambah soal.
  const { data: mem } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("role", "teacher")
    .eq("status", "active")
    .limit(1)
    .single();
  const orgId = (mem as { organization_id: string } | null)?.organization_id;
  let bank: { versionId: string; label: string }[] = [];
  if (orgId) {
    const { data: qs } = await supabase
      .from("questions")
      .select("id,prompt_json")
      .eq("organization_id", orgId)
      .limit(100);
    for (const q of (qs as { id: string; prompt_json: { text?: string } }[] | null) ?? []) {
      const { data: vs } = await supabase
        .from("question_versions")
        .select("id,version,points")
        .eq("question_id", q.id)
        .order("version");
      for (const v of (vs as { id: string; version: number; points: number }[] | null) ?? []) {
        bank.push({
          versionId: v.id,
          label: `${q.prompt_json.text?.slice(0, 40) ?? "?"} — v${v.version} (${v.points}p)`,
        });
      }
    }
  }
  return { activity, assessment, linked, bank };
}

export default async function AssessmentPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  let data: Awaited<ReturnType<typeof getData>>;
  try {
    data = await getData(activityId);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert">Assessment tidak dapat dimuat.</p>
      </main>
    );
  }
  if (!data) notFound();
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Assessment: {data.activity.title}</h1>
      <p className="text-sm text-slate-500">Tipe activity: {data.activity.type}</p>
      <AssessmentBuilder
        activityId={activityId}
        assessment={data.assessment}
        linked={data.linked}
        bank={data.bank}
      />
    </main>
  );
}
