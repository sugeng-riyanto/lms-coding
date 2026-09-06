import { createClient } from "@/lib/supabase/server";
import { QuestionBank } from "./question-bank";

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
    versions: { id: string; version: number; points: number }[];
  }[] = [];
  for (const q of (qs as
    { id: string; type: string; prompt_json: { text?: string }; difficulty: string }[] | null) ?? []) {
    const { data: vs } = await supabase
      .from("question_versions")
      .select("id,version,points")
      .eq("question_id", q.id)
      .order("version");
    questions.push({
      id: q.id,
      type: q.type,
      promptText: q.prompt_json.text ?? "",
      difficulty: q.difficulty,
      versions: ((vs as { id: string; version: number; points: number }[] | null) ?? []).map((v) => ({
        ...v,
      })),
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
        Soal berversi; kunci jawaban tidak pernah ke browser murid.
      </p>
      <QuestionBank initialQuestions={bank.questions} />
    </main>
  );
}
