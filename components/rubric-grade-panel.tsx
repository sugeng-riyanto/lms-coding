"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeResponseGrades, saveCriterionGrade } from "@/features/actions";
import type { QueueRubric } from "@/app/(teacher)/teacher/grading/page";

/**
 * Penilaian per kriteria (rubrik): simpan draf per kriteria lalu Finalize —
 * semua kriteria harus sudah final (draft=false) sebelum RPC menghitung
 * manual_score + grade_revisions + audit. Skor dicek server (<= max poin).
 */
export function RubricGradePanel({ responseId, rubric }: { responseId: string; rubric: QueueRubric }) {
  const router = useRouter();
  const [busy, setBusy] = useState<false | "draft" | "final">(false);
  const [notice, setNotice] = useState("");
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(rubric.criteria.map((c) => [c.criterionId, c.score === null ? "" : String(c.score)])),
  );
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>(() =>
    Object.fromEntries(rubric.criteria.map((c) => [c.criterionId, c.feedback])),
  );

  async function run(mode: "draft" | "final") {
    const entries = rubric.criteria
      .map((c) => ({ c, raw: scores[c.criterionId] }))
      .map(({ c, raw }) => ({ c, value: raw === undefined ? NaN : Number(raw) }))
      .filter(({ value }) => Number.isFinite(value) && value >= 0);
    if (entries.length !== rubric.criteria.length) {
      setNotice("Isi skor untuk semua kriteria terlebih dahulu (0 boleh).");
      return;
    }
    setBusy(mode);
    setNotice("");
    for (const { c, value } of entries) {
      const res = await saveCriterionGrade({
        responseId,
        criterionId: c.criterionId,
        score: Math.min(value, c.maxPoints),
        feedback: feedbacks[c.criterionId] ?? "",
        draft: mode === "draft",
      });
      if (!res.ok) {
        setBusy(false);
        setNotice(`Gagal menyimpan kriteria "${c.title}": ${res.error}`);
        return;
      }
    }
    if (mode === "final") {
      const res = await finalizeResponseGrades({ responseId });
      if (!res.ok) {
        setBusy(false);
        setNotice(`Gagal finalisasi: ${res.error}`);
        return;
      }
    }
    setBusy(false);
    router.refresh();
  }

  const allFinal = rubric.criteria.every((c) => !c.draft);

  return (
    <div className="mt-3">
      <p className="text-sm font-semibold">
        Penilaian rubrik: {rubric.title}
        <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {allFinal ? "sudah final — nilai manual terhitung" : "draf — belum terhitung"}
        </span>
      </p>
      <div className="mt-2 space-y-2">
        {rubric.criteria.map((c) => {
          const final = !c.draft;
          return (
            <div
              key={c.criterionId}
              className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-600"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {c.title} <span className="font-normal text-slate-500">(maks {c.maxPoints} poin)</span>
                  {final && (
                    <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-100">
                      final
                    </span>
                  )}
                </p>
                <label htmlFor={`cs-${responseId}-${c.criterionId}`} className="flex items-center gap-2">
                  <span className="text-xs font-semibold">Skor</span>
                  <input
                    id={`cs-${responseId}-${c.criterionId}`}
                    type="number"
                    min={0}
                    max={c.maxPoints}
                    disabled={final}
                    value={scores[c.criterionId] ?? ""}
                    onChange={(e) => setScores((s) => ({ ...s, [c.criterionId]: e.target.value }))}
                    className="w-24 rounded-lg border px-2 py-1.5"
                  />
                </label>
              </div>
              <label
                htmlFor={`cf-${responseId}-${c.criterionId}`}
                className="mt-1 block text-xs font-semibold"
              >
                Feedback kriteria
              </label>
              <textarea
                id={`cf-${responseId}-${c.criterionId}`}
                rows={2}
                disabled={final}
                value={feedbacks[c.criterionId] ?? ""}
                onChange={(e) => setFeedbacks((s) => ({ ...s, [c.criterionId]: e.target.value }))}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Catatan untuk kriteria ini (terlihat murid setelah release)."
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run("draft")}
          disabled={busy !== false || allFinal}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-600"
        >
          {busy === "draft" ? "Menyimpan draf…" : "Simpan sebagai draf"}
        </button>
        <button
          type="button"
          onClick={() => run("final")}
          disabled={busy !== false || allFinal}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "final" ? "Memfinalisasi…" : allFinal ? "Nilai sudah final" : "Finalize nilai"}
        </button>
      </div>
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
    </div>
  );
}
