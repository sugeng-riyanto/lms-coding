import { notFound } from "next/navigation";
import { getAttemptQuestions } from "@/features/actions";
import { QuizTaker } from "./quiz-taker";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  let data: Awaited<ReturnType<typeof getAttemptQuestions>>;
  try {
    data = await getAttemptQuestions(attemptId);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert">Kuis tidak dapat dimuat.</p>
      </main>
    );
  }
  if (!data.ok) notFound();
  if (data.status !== "in_progress") {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">Attempt {data.status}</h1>
        <p className="mt-2">Attempt ini sudah dikirim. Lihat hasil sesuai release policy guru.</p>
        <QuizTaker attemptId={attemptId} questions={[]} locked status={data.status} />
      </main>
    );
  }
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Kuis</h1>
      <p className="mt-1 text-sm text-slate-600">
        Jawaban tersimpan otomatis. Timer dan batas attempt dihitung server.
      </p>
      <QuizTaker attemptId={attemptId} questions={data.questions} status={data.status} />
    </main>
  );
}
