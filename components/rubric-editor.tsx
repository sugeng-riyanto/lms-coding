"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRubricVersion } from "@/features/actions";
import type { RubricInfo } from "@/app/(teacher)/teacher/questions/question-bank";

interface CriterionRow {
  key: number;
  title: string;
  maxPoints: string;
}

/**
 * Builder rubrik untuk satu versi soal (essay/file manual). Rubrik dibuat
 * server (action createRubricVersion) sebagai versi 1 dan diikat ke
 * question_versions.rubric_id. Bila rubrik sudah ada → tampil ringkasan
 * (rubrik berversi: perubahan = rubrik baru + versi soal berikutnya).
 */
export function RubricEditor({
  questionType,
  versionId,
  versionNumber,
  existing,
}: {
  questionType: string;
  versionId: string | null;
  versionNumber: number | null;
  existing: RubricInfo | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState<CriterionRow[]>([{ key: 1, title: "", maxPoints: "" }]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const manualType = questionType === "essay_manual" || questionType === "file_manual";
  if (!manualType) return null;

  if (existing) {
    return (
      <div className="mt-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-600">
        <p className="font-semibold">Rubrik terpasang: {existing.title}</p>
        <ul className="mt-1 list-inside list-disc text-slate-600 dark:text-slate-300">
          {existing.criteria.map((c) => (
            <li key={c.criterionId}>
              {c.title} — {c.maxPoints} poin
            </li>
          ))}
        </ul>
        <p className="mt-1 text-slate-500">
          Rubrik berversi: untuk mengubah kriteria, terbitkan versi soal baru lalu buat rubrik baru di versi
          tersebut.
        </p>
      </div>
    );
  }

  if (!versionId) {
    return (
      <p className="mt-2 text-xs text-slate-500">
        Terbitkan versi soal terlebih dahulu untuk memakai rubrik.
      </p>
    );
  }

  function addCriterion() {
    setCriteria((prev) => [...prev, { key: prev.length + 1, title: "", maxPoints: "" }]);
  }
  function removeCriterion(key: number) {
    setCriteria((prev) => prev.filter((c) => c.key !== key));
  }
  function patch(key: number, field: "title" | "maxPoints", value: string) {
    setCriteria((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  }

  async function onCreate() {
    const cleaned = criteria
      .map((c) => ({ title: c.title.trim(), maxPoints: Number(c.maxPoints) }))
      .filter((c) => c.title !== "" && Number.isFinite(c.maxPoints) && c.maxPoints > 0);
    if (title.trim().length < 3 || cleaned.length === 0) {
      setNotice("Isi judul rubrik (min. 3 karakter) dan minimal satu kriteria dengan poin &gt; 0.");
      return;
    }
    setBusy(true);
    setNotice("");
    const res = await createRubricVersion({
      questionVersionId: versionId,
      title: title.trim(),
      criteria: cleaned,
    });
    setBusy(false);
    if (!res.ok) {
      setNotice(`Gagal membuat rubrik: ${res.error}`);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          + Buat rubrik penilaian (versi {versionNumber})
        </button>
      ) : (
        <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Rubrik baru — soal v{versionNumber}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 underline">
              Tutup
            </button>
          </div>
          <label htmlFor={`rub-${versionId}-title`} className="mt-2 block text-xs font-semibold">
            Judul rubrik
          </label>
          <input
            id={`rub-${versionId}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={3}
            maxLength={200}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Mis. Rubrik Esai Pemrograman"
          />
          <div className="mt-2 space-y-2">
            {criteria.map((c, i) => (
              <div key={c.key} className="flex flex-wrap items-end gap-2">
                <div className="min-w-40 flex-1">
                  <label htmlFor={`rub-${versionId}-c-${c.key}`} className="text-xs font-semibold">
                    Kriteria {i + 1}
                  </label>
                  <input
                    id={`rub-${versionId}-c-${c.key}`}
                    value={c.title}
                    onChange={(e) => patch(c.key, "title", e.target.value)}
                    maxLength={200}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Mis. Ketepatan algoritma"
                  />
                </div>
                <div>
                  <label htmlFor={`rub-${versionId}-m-${c.key}`} className="text-xs font-semibold">
                    Poin maks
                  </label>
                  <input
                    id={`rub-${versionId}-m-${c.key}`}
                    type="number"
                    min={1}
                    value={c.maxPoints}
                    onChange={(e) => patch(c.key, "maxPoints", e.target.value)}
                    className="mt-1 w-24 rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCriterion(c.key)}
                  disabled={criteria.length <= 1}
                  aria-label={`Hapus kriteria ${i + 1}`}
                  className="rounded-lg border px-2 py-1.5 text-xs disabled:opacity-40"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addCriterion}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-600"
            >
              + Kriteria
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={busy}
              className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Menyimpan…" : "Simpan rubrik"}
            </button>
          </div>
          {notice && (
            <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
