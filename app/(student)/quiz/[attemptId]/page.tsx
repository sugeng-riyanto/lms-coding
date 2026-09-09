import { notFound } from "next/navigation";
import { getAttemptQuestions, getAttemptResult } from "@/features/actions";
import { getLang, mkT } from "@/lib/i18n";
import { QUIZ } from "@/lib/ui-text/quiz";
import { QuizTaker } from "./quiz-taker";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const lang = await getLang();
  const t = mkT(QUIZ, lang);
  let data: Awaited<ReturnType<typeof getAttemptQuestions>>;
  try {
    data = await getAttemptQuestions(attemptId);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert">{t("loadFailed")}</p>
      </main>
    );
  }
  if (!data.ok) notFound();
  if (data.status !== "in_progress") {
    // Server-render the result/pending-release panel so reloading the page
    // doesn't drop it. getAttemptResult respects the release policy.
    let initialResult: Awaited<ReturnType<typeof getAttemptResult>> | null = null;
    try {
      initialResult = await getAttemptResult(attemptId);
    } catch {
      // If result fetch fails (auth edge case), render without panel —
      // the user can still see the "already submitted" message.
    }
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">{t("attemptStatus").replace("{status}", data.status)}</h1>
        <p className="mt-2">{t("alreadySubmitted")}</p>
        <QuizTaker
          attemptId={attemptId}
          questions={[]}
          locked
          status={data.status}
          initialResult={initialResult}
          lang={lang}
        />
      </main>
    );
  }
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("autosaveNote")}</p>
      <QuizTaker attemptId={attemptId} questions={data.questions} status={data.status} lang={lang} />
    </main>
  );
}
