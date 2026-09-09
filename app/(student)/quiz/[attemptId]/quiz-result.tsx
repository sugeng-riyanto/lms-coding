"use client";

import { useEffect, useState } from "react";
import { getAttemptFeedback } from "@/features/actions";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { QUIZ } from "@/lib/ui-text/quiz";
import type { QuizFeedbackItem } from "@/lib/quiz-feedback";

interface Props {
  attemptId: string;
  lang: Lang;
}

export function QuizResult({ attemptId, lang }: Props) {
  const t = mkT(QUIZ, lang);
  const [items, setItems] = useState<QuizFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getAttemptFeedback(attemptId).then((res) => {
      if (!cancelled && res.ok && res.visible) setItems(res.items);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (loading) {
    return (
      <p role="status" className="text-sm text-slate-500">
        {t("loadingFeedback")}
      </p>
    );
  }

  if (items.length === 0) return null;

  const correctCount = items.filter((i) => i.isCorrect && !i.needsManualGrade).length;
  const totalAuto = items.filter((i) => !i.needsManualGrade).length;

  return (
    <section aria-label={t("feedbackSection")} className="mt-6 space-y-4">
      <h2 className="text-lg font-semibold">{t("feedbackTitle")}</h2>
      <p className="text-sm text-slate-600">
        {fmt(t("feedbackSummary"), {
          correct: String(correctCount),
          total: String(totalAuto),
        })}
      </p>
      {items.map((item, idx) => (
        <FeedbackCard key={item.questionVersionId} item={item} index={idx} t={t} />
      ))}
    </section>
  );
}

function FeedbackCard({
  item,
  index,
  t,
}: {
  item: QuizFeedbackItem;
  index: number;
  t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl border p-4 ${
        item.needsManualGrade
          ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
          : item.isCorrect
            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold">
            {fmt(t("questionLabel"), { n: index + 1 })}
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({fmt(t("points"), { points: item.points })})
            </span>
          </h3>
          <p className="mt-1 text-sm">{item.promptText}</p>
        </div>
        <Badge item={item} t={t} />
      </div>

      {/* Student answer */}
      <div className="mt-3">
        <span className="text-xs font-medium uppercase text-slate-500">{t("yourAnswer")}</span>
        <p className="mt-0.5 text-sm">{formatAnswer(item)}</p>
      </div>

      {/* Correct answer (auto-graded only) */}
      {!item.needsManualGrade && !item.isCorrect && item.correctAnswer && (
        <div className="mt-2">
          <span className="text-xs font-medium uppercase text-green-700 dark:text-green-400">
            {t("correctAnswer")}
          </span>
          <p className="mt-0.5 text-sm font-medium text-green-800 dark:text-green-300">
            {formatCorrectAnswer(item)}
          </p>
        </div>
      )}

      {/* Score */}
      <div className="mt-2 text-sm">
        <span className="font-medium">{t("score")}: </span>
        <span>
          {item.score} / {item.points}
        </span>
      </div>

      {/* Manual grading pending */}
      {item.needsManualGrade && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{t("awaitingManualGrade")}</p>
      )}

      {/* Explanation toggle */}
      {item.explanation && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            aria-expanded={expanded}
          >
            {expanded ? t("hideExplanation") : t("showExplanation")}
          </button>
          {expanded && (
            <div className="mt-2 rounded-lg bg-white/60 p-3 text-sm dark:bg-slate-800/60">
              {item.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ item, t }: { item: QuizFeedbackItem; t: (key: string) => string }) {
  if (item.needsManualGrade) {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        {t("badgePending")}
      </span>
    );
  }
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        item.isCorrect
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      }`}
    >
      {item.isCorrect ? t("badgeCorrect") : t("badgeIncorrect")}
    </span>
  );
}

function formatAnswer(item: QuizFeedbackItem): string {
  if (item.answer === null || item.answer === undefined) return "—";
  if (Array.isArray(item.answer)) return item.answer.join(", ") || "—";
  if (typeof item.answer === "object") {
    if ("filePath" in (item.answer as Record<string, unknown>))
      return String((item.answer as { filePath: string }).filePath);
    return JSON.stringify(item.answer);
  }
  return String(item.answer);
}

function formatCorrectAnswer(item: QuizFeedbackItem): string {
  if (!item.correctAnswer) return "—";
  if (item.type === "single_choice" || item.type === "true_false") {
    const idx = item.options.indexOf(item.correctAnswer);
    return idx >= 0 ? `${item.correctAnswer})` : item.correctAnswer;
  }
  return item.correctAnswer;
}
