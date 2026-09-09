"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAttemptResult, saveResponse, submitAttempt } from "@/features/actions";
import { UploadBox } from "@/components/upload-box";
import { CanvasPad } from "@/components/canvas-pad";
import { QuestionMedia } from "@/components/media-embed";
import { makeClientEventId } from "@/lib/sync-queue";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { QUIZ } from "@/lib/ui-text/quiz";
import type { SanitizedQuestion } from "@/lib/attempt";

interface Props {
  attemptId: string;
  questions: (SanitizedQuestion & { savedAnswer: unknown })[];
  status: string;
  locked?: boolean;
  lang: Lang;
  /** Server-fetched result for submitted attempts — survives page reload. */
  initialResult?: Result | null;
}

type Result = Awaited<ReturnType<typeof getAttemptResult>>;

export function QuizTaker({ attemptId, questions, status, locked, lang, initialResult }: Props) {
  const router = useRouter();
  const t = mkT(QUIZ, lang);
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    Object.fromEntries(questions.map((q) => [q.questionVersionId, q.savedAnswer ?? null])),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(initialResult ?? null);

  function setAnswer(qvId: string, value: unknown) {
    setAnswers((a) => ({ ...a, [qvId]: value }));
    setSaving(qvId);
    void saveResponse({ attemptId, questionVersionId: qvId, answer: value }).then((res) => {
      setSaving(null);
      if (!res.ok) setError(fmt(t("saveFailed"), { error: res.error }));
    });
  }

  async function onSubmit() {
    if (!window.confirm(t("confirmSubmit"))) return;
    setSubmitting(true);
    setError("");
    const res = await submitAttempt({ attemptId, idempotencyKey: makeClientEventId() });
    if (!res.ok) {
      setSubmitting(false);
      setError(
        res.error === "TIME_EXPIRED" ? t("timeExpired") : fmt(t("submitFailed"), { error: res.error }),
      );
      return;
    }
    const r = await getAttemptResult(attemptId);
    setResult(r);
    setSubmitting(false);
    router.refresh();
  }

  function renderInput(q: SanitizedQuestion) {
    const v = answers[q.questionVersionId];
    const disabled = locked === true || submitting;
    if (q.type === "single_choice" || q.type === "true_false") {
      const opts = q.type === "true_false" ? ["true", "false"] : q.options;
      return (
        <div role="radiogroup" aria-label={q.promptText} className="mt-2 space-y-1">
          {opts.map((o, i) => (
            <label key={o} className="flex items-center gap-2 rounded border px-3 py-2">
              <input
                type="radio"
                name={q.questionVersionId}
                disabled={disabled}
                checked={v === o || v === String(i)}
                onChange={() => setAnswer(q.questionVersionId, o)}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    if (q.type === "multiple_choice") {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      return (
        <fieldset className="mt-2 space-y-1">
          <legend className="sr-only">{q.promptText}</legend>
          {q.options.map((o) => (
            <label key={o} className="flex items-center gap-2 rounded border px-3 py-2">
              <input
                type="checkbox"
                disabled={disabled}
                checked={arr.includes(o)}
                onChange={() =>
                  setAnswer(q.questionVersionId, arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])
                }
              />
              {o}
            </label>
          ))}
        </fieldset>
      );
    }
    if (q.type === "numeric_tolerance") {
      return (
        <input
          type="number"
          step="any"
          disabled={disabled}
          aria-label={q.promptText}
          value={typeof v === "number" ? v : ""}
          onChange={(e) =>
            setAnswer(q.questionVersionId, e.target.value === "" ? null : Number(e.target.value))
          }
          className="mt-2 w-48 rounded-lg border px-3 py-2"
        />
      );
    }
    if (q.type === "essay_manual" || q.type === "file_manual") {
      return (
        <div>
          <textarea
            rows={4}
            disabled={disabled}
            aria-label={q.promptText}
            value={typeof v === "string" ? v : ""}
            onChange={(e) => setAnswer(q.questionVersionId, e.target.value)}
            placeholder={q.type === "essay_manual" ? t("essayPlaceholder") : t("filePlaceholder")}
            className="mt-2 w-full rounded-lg border px-3 py-2"
          />
          {/* Kanvas anotasi sains/math: murid menggambar jawaban/coretan di sini. */}
          {q.type === "essay_manual" && (
            <div className="mt-3">
              <CanvasPad
                attemptId={attemptId}
                questionVersionId={q.questionVersionId}
                lang={lang}
                role="student"
                readOnly={disabled}
              />
            </div>
          )}
          {q.type === "file_manual" && !disabled && (
            <UploadBox
              lang={lang}
              onUploaded={(path) =>
                setAnswer(q.questionVersionId, { filePath: path, note: typeof v === "string" ? v : "" })
              }
            />
          )}
          {typeof v === "object" && v !== null && "filePath" in v && (
            <p className="mt-1 text-sm text-green-700">
              {fmt(t("fileUploaded"), { path: String((v as { filePath: string }).filePath) })}
            </p>
          )}
        </div>
      );
    }
    return (
      <input
        type="text"
        disabled={disabled}
        aria-label={q.promptText}
        value={typeof v === "string" ? v : ""}
        onChange={(e) => setAnswer(q.questionVersionId, e.target.value)}
        className="mt-2 w-full rounded-lg border px-3 py-2"
      />
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {saving && (
        <p role="status" className="text-sm text-slate-500">
          {t("saving")}
        </p>
      )}
      {questions.map((q, i) => (
        <section
          key={q.questionVersionId}
          aria-label={fmt(t("questionLabel"), { n: i + 1 })}
          className="rounded-xl border p-4"
        >
          <h2 className="font-semibold">
            {fmt(t("questionLabel"), { n: i + 1 })}{" "}
            <span className="text-sm font-normal text-slate-500">
              ({fmt(t("points"), { points: q.points })})
            </span>
          </h2>
          {/* Media embed pada butir soal (materi/kuis): youtube, pdf, web, video, audio, image. */}
          <QuestionMedia media={q.media} />
          <p className="mt-1">{q.promptText}</p>
          {renderInput(q)}
        </section>
      ))}
      {locked !== true && (
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? t("submitting") : fmt(t("submitWithStatus"), { status })}
        </button>
      )}
      {result?.ok && result.visible && (
        <section aria-label={t("results")} className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="font-bold">{fmt(t("resultTitle"), { score: result.finalScore ?? "—" })}</h2>
          <ul className="mt-2 text-sm">
            {result.items.map((it) => (
              <li key={it.question_version_id}>
                {fmt(t("autoScore"), { score: it.auto_score ?? "—" })}
                {it.manual_score !== null && it.manual_score !== undefined
                  ? fmt(t("manualScore"), { score: it.manual_score })
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      {result?.ok && !result.visible && (
        <p role="status" className="rounded-xl border p-4">
          {t("pendingRelease")}
        </p>
      )}
    </div>
  );
}
