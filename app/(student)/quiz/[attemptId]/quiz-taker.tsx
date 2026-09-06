"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAttemptResult, saveResponse, submitAttempt } from "@/features/actions";
import { makeClientEventId } from "@/lib/sync-queue";
import type { SanitizedQuestion } from "@/lib/attempt";

interface Props {
  attemptId: string;
  questions: (SanitizedQuestion & { savedAnswer: unknown })[];
  status: string;
  locked?: boolean;
}

type Result = Awaited<ReturnType<typeof getAttemptResult>>;

export function QuizTaker({ attemptId, questions, status, locked }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    Object.fromEntries(questions.map((q) => [q.questionVersionId, q.savedAnswer ?? null])),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  function setAnswer(qvId: string, value: unknown) {
    setAnswers((a) => ({ ...a, [qvId]: value }));
    setSaving(qvId);
    void saveResponse({ attemptId, questionVersionId: qvId, answer: value }).then((res) => {
      setSaving(null);
      if (!res.ok) setError(`Gagal menyimpan: ${res.error}`);
    });
  }

  async function onSubmit() {
    if (!window.confirm("Kirim jawaban? Attempt akan dikunci.")) return;
    setSubmitting(true);
    setError("");
    const res = await submitAttempt({ attemptId, idempotencyKey: makeClientEventId() });
    if (!res.ok) {
      setSubmitting(false);
      setError(res.error === "TIME_EXPIRED" ? "Waktu habis — hubungi guru." : `Gagal submit: ${res.error}`);
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
        <textarea
          rows={4}
          disabled={disabled}
          aria-label={q.promptText}
          value={typeof v === "string" ? v : ""}
          onChange={(e) => setAnswer(q.questionVersionId, e.target.value)}
          placeholder={q.type === "essay_manual" ? "Tulis jawabanmu…" : "Deskripsikan file proyekmu…"}
          className="mt-2 w-full rounded-lg border px-3 py-2"
        />
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
          Menyimpan…
        </p>
      )}
      {questions.map((q, i) => (
        <section key={q.questionVersionId} aria-label={`Soal ${i + 1}`} className="rounded-xl border p-4">
          <h2 className="font-semibold">
            Soal {i + 1} <span className="text-sm font-normal text-slate-500">({q.points} poin)</span>
          </h2>
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
          {submitting ? "Mengirim…" : `Kirim jawaban (status: ${status})`}
        </button>
      )}
      {result?.ok && result.visible && (
        <section aria-label="Hasil" className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="font-bold">Hasil: {result.finalScore ?? "—"}</h2>
          <ul className="mt-2 text-sm">
            {result.items.map((it) => (
              <li key={it.question_version_id}>
                Otomatis: {it.auto_score ?? "—"}
                {it.manual_score !== null && it.manual_score !== undefined
                  ? ` · Manual: ${it.manual_score}`
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      {result?.ok && !result.visible && (
        <p role="status" className="rounded-xl border p-4">
          Jawaban terkirim. Nilai menunggu release guru.
        </p>
      )}
    </div>
  );
}
