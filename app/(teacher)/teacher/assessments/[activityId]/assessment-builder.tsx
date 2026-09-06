"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addQuestionToAssessment, createAssessment, releaseGrades } from "@/features/actions";

export interface LinkedQ {
  question_version_id: string;
  position: number;
  points: number;
  promptText: string;
}

export function AssessmentBuilder({
  activityId,
  assessment,
  linked,
  bank,
}: {
  activityId: string;
  assessment: { id: string; settings_json: Record<string, unknown>; total_points: number } | null;
  linked: LinkedQ[];
  bank: { versionId: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pick, setPick] = useState("");
  const [points, setPoints] = useState("10");
  const [randomize, setRandomize] = useState(false);
  const [poolSize, setPoolSize] = useState("");

  async function onCreate() {
    setBusy(true);
    const res = await createAssessment({
      activityId,
      maxAttempts: 3,
      cooldownSeconds: 0,
      durationSeconds: 0,
      release: "immediate",
      randomize,
      poolSize: poolSize.trim() === "" ? undefined : Number(poolSize),
    });
    setBusy(false);
    setNotice(res.ok ? "Assessment dibuat." : `Gagal: ${res.error}`);
    if (res.ok) router.refresh();
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!assessment || !pick) return;
    setBusy(true);
    const res = await addQuestionToAssessment({
      assessmentId: assessment.id,
      questionVersionId: pick,
      points: Number(points),
    });
    setBusy(false);
    setNotice(res.ok ? "Soal ditambahkan." : `Gagal: ${res.error}`);
    if (res.ok) router.refresh();
  }

  async function onRelease() {
    if (!assessment || !window.confirm("Release nilai ke murid?")) return;
    setBusy(true);
    const res = await releaseGrades({ assessmentId: assessment.id });
    setBusy(false);
    setNotice(res.ok ? "Nilai di-release (submitted → finalized)." : `Gagal: ${res.error}`);
    if (res.ok) router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      {notice && (
        <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">
          {notice}
        </p>
      )}
      {!assessment ? (
        <div className="rounded-xl border p-5">
          <p>Belum ada assessment untuk activity ini.</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={randomize}
                onChange={(e) => setRandomize(e.target.checked)}
                className="size-4"
              />
              Acak urutan soal per attempt (seed server, reproducible)
            </label>
            <label htmlFor="pool-size" className="flex items-center gap-2 text-sm">
              <span>Jumlah soal per attempt (kosong = semua):</span>
              <input
                id="pool-size"
                type="number"
                min={1}
                disabled={!randomize}
                value={poolSize}
                onChange={(e) => setPoolSize(e.target.value)}
                className="w-24 rounded-lg border px-3 py-1 disabled:opacity-50"
              />
            </label>
          </div>
          <button
            onClick={onCreate}
            disabled={busy}
            className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            Buat assessment (limit 3, release immediate)
          </button>
        </div>
      ) : (
        <>
          <section aria-label="Soal terhubung" className="rounded-xl border p-4">
            <h2 className="font-semibold">Soal ({linked.length})</h2>
            {linked.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">Belum ada soal. Tambahkan dari bank.</p>
            ) : (
              <ol className="mt-2 space-y-1 text-sm">
                {linked.map((l) => (
                  <li key={l.question_version_id}>
                    #{l.position + 1} — {l.promptText} ({l.points}p)
                  </li>
                ))}
              </ol>
            )}
          </section>
          <form
            onSubmit={onAdd}
            aria-label="Tambah soal ke assessment"
            className="flex flex-wrap items-end gap-2 rounded-xl border p-4"
          >
            <div className="min-w-52 flex-1">
              <label htmlFor="pick-q" className="text-sm font-semibold">
                Soal dari bank
              </label>
              <select
                id="pick-q"
                required
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="">— pilih —</option>
                {bank.map((b) => (
                  <option key={b.versionId} value={b.versionId}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pick-p" className="text-sm font-semibold">
                Poin
              </label>
              <input
                id="pick-p"
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="mt-1 w-28 rounded-lg border px-3 py-2"
              />
            </div>
            <button
              disabled={busy}
              className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              Tambah
            </button>
          </form>
          <button onClick={onRelease} disabled={busy} className="rounded-lg border px-4 py-2 font-semibold">
            Release nilai
          </button>
        </>
      )}
    </div>
  );
}
