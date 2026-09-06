import { createClient } from "@/lib/supabase/server";
import { QuestionBank, type RubricInfo } from "./question-bank";

export const dynamic = "force-dynamic";

async function getBank(userId: string) {
  const supabase = await createClient();
  const { data: mem } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "teacher")
    .eq("status", "active")
    .limit(1)
    .single();
  const orgId = (mem as { organization_id: string } | null)?.organization_id;
  if (!orgId) return { questions: [], orgId: "" };
  const { data: qs } = await supabase
    .from("questions")
    .select("id,type,prompt_json,difficulty")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  const questions: {
    id: string;
    type: string;
    promptText: string;
    difficulty: string;
    versions: {
      id: string;
      version: number;
      points: number;
      rubric: RubricInfo | null;
    }[];
  }[] = [];
  for (const q of (qs as
    { id: string; type: string; prompt_json: { text?: string }; difficulty: string }[] | null) ?? []) {
    const { data: vs } = await supabase
      .from("question_versions")
      .select("id,version,points,rubric_id")
      .eq("question_id", q.id)
      .order("version");
    const versions = (
      (vs as { id: string; version: number; points: number; rubric_id: string | null }[] | null) ?? []
    ).map((v) => ({ id: v.id, version: v.version, points: v.points, rubric: null as RubricInfo | null }));
    // Muat rubrik untuk tipe manual yang punya versi ber-rubrik (bulk, hindari N+1).
    const manual = q.type === "essay_manual" || q.type === "file_manual";
    const rubricIds = manual
      ? [
          ...new Set(
            ((vs as { rubric_id: string | null }[] | null) ?? []).map((v) => v.rubric_id).filter(Boolean),
          ),
        ]
      : [];
    const rubricById = new Map<string, RubricInfo>();
    if (rubricIds.length > 0) {
      const { data: rubrics } = await supabase.from("rubrics").select("id,title,version").in("id", rubricIds);
      for (const rb of (rubrics as { id: string; title: string; version: number }[] | null) ?? []) {
        // Kriteria VERSI AKTIF saja (re-versioning menyimpan versi lama).
        const { data: crits } = await supabase
          .from("rubric_criteria")
          .select("id,title,max_points")
          .eq("rubric_id", rb.id)
          .eq("version", rb.version)
          .order("position");
        rubricById.set(rb.id, {
          id: rb.id,
          title: rb.title,
          version: rb.version,
          criteria: ((crits as { id: string; title: string; max_points: number }[] | null) ?? []).map(
            (c) => ({ criterionId: c.id, title: c.title, maxPoints: Number(c.max_points) }),
          ),
        });
      }
    }
    for (const v of versions) {
      const linked = (vs as { id: string; rubric_id: string | null }[] | null)?.find(
        (x) => x.id === v.id,
      )?.rubric_id;
      if (linked && rubricById.has(linked)) v.rubric = rubricById.get(linked) ?? null;
    }
    questions.push({
      id: q.id,
      type: q.type,
      promptText: q.prompt_json.text ?? "",
      difficulty: q.difficulty,
      versions,
    });
  }
  return { questions, orgId };
}

export default async function BankPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub ?? "";
  let bank = { questions: [] as Awaited<ReturnType<typeof getBank>>["questions"], orgId: "" };
  try {
    bank = await getBank(userId);
  } catch {
    bank = { questions: [], orgId: "" };
  }
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Bank soal</h1>
      <p className="mt-1 text-sm text-slate-600">
        Soal berversi; kunci jawaban tidak pernah ke browser murid. Soal esai/proyek dapat diberi rubrik
        penilaian berversi.
      </p>
      <QuestionBank initialQuestions={bank.questions} />
    </main>
  );
}
