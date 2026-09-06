"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuestion, publishQuestionVersion } from "@/features/actions";
import { buildGradingRule } from "@/lib/attempt";
import type { QuestionType } from "@/lib/grading";

export interface BankQuestion {
  id: string;
  type: string;
  promptText: string;
  difficulty: string;
  versions: { id: string; version: number; points: number }[];
}

const TYPES: QuestionType[] = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "numeric_tolerance",
  "short_text",
  "essay_manual",
  "file_manual",
];

export function QuestionBank({ initialQuestions }: { initialQuestions: BankQuestion[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [type, setType] = useState<QuestionType>("single_choice");
  const [prompt, setPrompt] = useState("");
  const [versionQ, setVersionQ] = useState("");
  const [points, setPoints] = useState("10");
  const [gradingText, setGradingText] = useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createQuestion({ type, promptText: prompt, difficulty: "medium" });
    setBusy(false);
    if (!res.ok) setNotice(`Gagal: ${res.error}`);
    else {
      setPrompt("");
      setNotice("Soal dibuat. Tambahkan versi + kunci di bawah.");
      router.refresh();
    }
  }

  async function onVersion(e: React.FormEvent) {
    e.preventDefault();
    const q = initialQuestions.find((x) => x.id === versionQ);
    if (!q) return;
    setBusy(true);
    try {
      const fields: Record<string, string> = {};
      // Format per tipe: single/true_false → baris correct; multiple → corrects; numeric → expected|tolAbs|tolRel; short → accepted multiline
      for (const line of gradingText.split("\n")) {
        const [k, ...rest] = line.split("=");
        if (k && rest.length > 0) fields[k.trim()] = rest.join("=").trim();
      }
      const rule = buildGradingRule(q.type as QuestionType, Number(points), fields);
      const res = await publishQuestionVersion({
        questionId: q.id,
        points: Number(points),
        grading: rule as unknown as Record<string, unknown>,
      });
      if (!res.ok) setNotice(`Gagal versi: ${res.error}`);
      else {
        setGradingText("");
        setNotice(`Versi ${q.versions.length + 1} terbit.`);
        router.refresh();
      }
    } catch {
      setNotice("Format grading tidak valid.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-6 space-y-6">
      {notice && (
        <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">
          {notice}
        </p>
      )}
      <form onSubmit={onCreate} aria-label="Tambah soal" className="rounded-xl border p-4">
        <h2 className="font-semibold">+ Soal baru</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div>
            <label htmlFor="q-type" className="text-sm font-semibold">
              Tipe
            </label>
            <select
              id="q-type"
              value={type}
              onChange={(e) => setType(e.target.value as QuestionType)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="q-prompt" className="text-sm font-semibold">
              Prompt
            </label>
            <input
              id="q-prompt"
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              minLength={3}
              maxLength={5000}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>
        </div>
        <button
          disabled={busy}
          className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          Tambah
        </button>
      </form>

      <form onSubmit={onVersion} aria-label="Terbit versi soal" className="rounded-xl border p-4">
        <h2 className="font-semibold">Terbit versi + kunci jawaban</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <div>
            <label htmlFor="v-q" className="text-sm font-semibold">
              Soal
            </label>
            <select
              id="v-q"
              required
              value={versionQ}
              onChange={(e) => setVersionQ(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              <option value="">— pilih —</option>
              {initialQuestions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.type} — {q.promptText.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="v-points" className="text-sm font-semibold">
              Poin
            </label>
            <input
              id="v-points"
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>
        </div>
        <label htmlFor="v-grading" className="mt-2 block text-sm font-semibold">
          Kunci (baris key=value; mis. correct=b · corrects=a,c · expected=3.14, tolAbs=0.01 ·
          accepted=Soekarno)
        </label>
        <textarea
          id="v-grading"
          rows={3}
          value={gradingText}
          onChange={(e) => setGradingText(e.target.value)}
          placeholder={"correct=b"}
          className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
        />
        <button
          disabled={busy}
          className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          Terbit versi
        </button>
      </form>

      <section aria-label="Daftar soal" className="space-y-2">
        {initialQuestions.length === 0 && (
          <p className="rounded-xl border p-4 text-slate-600">Bank masih kosong.</p>
        )}
        {initialQuestions.map((q) => (
          <div key={q.id} className="rounded-xl border p-3 text-sm">
            <p>
              <strong>{q.type}</strong> · {q.promptText}
            </p>
            <p className="text-slate-500">
              {q.versions.length === 0
                ? "belum ada versi"
                : q.versions.map((v) => `v${v.version} (${v.points}p)`).join(", ")}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
