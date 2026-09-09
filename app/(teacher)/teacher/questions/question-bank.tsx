"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { bulkImportQuestionPack, createQuestion, publishQuestionVersion } from "@/features/actions";
import { buildGradingRule } from "@/lib/attempt";
import type { QuestionType } from "@/lib/grading";
import { questionPackTemplateSample } from "@/lib/question-pack";
import { QUESTION_PACK_FORMAT_GUIDE, buildQuestionPackAiPrompt } from "@/lib/question-pack-ai-prompt";
import { RubricEditor } from "@/components/rubric-editor";
import { loadLocalPref, saveLocalPref } from "@/lib/client-storage";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { QUESTION } from "@/lib/ui-text/question";

const PACK_TOPIC_KEY = "ai:pack-topic";
const PACK_COUNT_KEY = "ai:pack-count";

export interface RubricInfo {
  id: string;
  title: string;
  version: number;
  criteria: { criterionId: string; title: string; maxPoints: number }[];
}

export interface BankQuestion {
  id: string;
  type: string;
  promptText: string;
  difficulty: string;
  versions: { id: string; version: number; points: number; rubric: RubricInfo | null }[];
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

export function QuestionBank({ initialQuestions, lang }: { initialQuestions: BankQuestion[]; lang: Lang }) {
  const t = mkT(QUESTION, lang);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [type, setType] = useState<QuestionType>("single_choice");
  const [prompt, setPrompt] = useState("");
  const [optionsText, setOptionsText] = useState("");
  // Media opsional pada butir soal (embed youtube/pdf/web/video/image/audio).
  const [mediaType, setMediaType] = useState<string>("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [versionQ, setVersionQ] = useState("");
  const [points, setPoints] = useState("10");
  const [gradingText, setGradingText] = useState("");
  const searchParams = useSearchParams();
  const initialPack = searchParams.get("pack") ?? "";
  const [pack, setPack] = useState(initialPack);
  const [packErrors, setPackErrors] = useState<string[]>([]);
  const [aiCopied, setAiCopied] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const needsOptions = type === "single_choice" || type === "multiple_choice";

  // Pulihkan topik & jumlah soal AI terakhir dari perangkat (setelah hidrasi).
  useEffect(() => {
    const tId = window.setTimeout(() => {
      const topic = loadLocalPref<string>(PACK_TOPIC_KEY);
      if (topic && topic.trim().length > 0) setAiTopic(topic);
      const count = loadLocalPref<number>(PACK_COUNT_KEY);
      if (typeof count === "number" && Number.isFinite(count)) {
        setAiCount(Math.min(100, Math.max(1, Math.floor(count))));
      }
    }, 0);
    return () => window.clearTimeout(tId);
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const options = optionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (needsOptions && options.length < 2) {
      setNotice(t("errOptions"));
      return;
    }
    setBusy(true);
    const media =
      mediaType && mediaUrl.trim()
        ? { type: mediaType as "youtube" | "pdf" | "web" | "video" | "image" | "audio", url: mediaUrl.trim() }
        : undefined;
    const res = await createQuestion({ type, promptText: prompt, difficulty: "medium", options, media });
    setBusy(false);
    if (!res.ok) setNotice(fmt(t("failPrefix"), { error: res.error }));
    else {
      setPrompt("");
      setOptionsText("");
      setMediaType("");
      setMediaUrl("");
      setNotice(t("created"));
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
      if (!res.ok) setNotice(fmt(t("versionFail"), { error: res.error }));
      else {
        setGradingText("");
        setNotice(fmt(t("versionPublished"), { n: q.versions.length + 1 }));
        router.refresh();
      }
    } catch {
      setNotice(t("errGradingFormat"));
    }
    setBusy(false);
  }

  function builtPackAiPrompt(): string {
    return buildQuestionPackAiPrompt({
      topic: aiTopic.trim() || undefined,
      count: aiCount,
    });
  }

  async function copyPackAiPrompt() {
    const text = builtPackAiPrompt();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setAiCopied(true);
    window.setTimeout(() => setAiCopied(false), 2000);
  }

  async function onImportPack(e: React.FormEvent) {
    e.preventDefault();
    if (pack.trim().length === 0) {
      setPackErrors([t("packPlaceholder")]);
      return;
    }
    setBusy(true);
    const res = await bulkImportQuestionPack({ pack });
    setBusy(false);
    if (!res.ok) {
      setPackErrors([fmt(t("importFailed"), { error: res.error }), ...(res.errors ?? [])].slice(0, 8));
      return;
    }
    setPackErrors(
      [fmt(t("packCreated"), { created: res.created })]
        .concat(res.errors ?? [])
        .concat(res.created === 0 ? [t("noValidRows")] : [])
        .slice(0, 8),
    );
    if (res.created > 0) {
      setPack("");
      setNotice(fmt(t("packImported"), { created: res.created }));
      router.refresh();
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {notice && (
        <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">
          {notice}
        </p>
      )}
      <form onSubmit={onImportPack} aria-label={t("importPackAria")} className="rounded-xl border p-4">
        <h2 className="font-semibold">{t("packTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("packDesc")}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-blue-700 dark:text-blue-300">
            {t("packSample")}
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg border bg-slate-50 p-3 font-mono text-xs whitespace-pre dark:bg-slate-900">
            {questionPackTemplateSample()}
          </pre>
        </details>
        <details className="mt-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/40">
          <summary className="cursor-pointer text-xs font-semibold text-blue-800 select-none dark:text-blue-300">
            {t("aiPromptSummary")}
          </summary>{" "}
          <div className="mt-2 space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">{t("aiPromptDesc")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="q-ai-topic"
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {t("aiTopicLabel")}
                </label>
                <input
                  id="q-ai-topic"
                  type="text"
                  value={aiTopic}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAiTopic(v);
                    if (v.trim().length > 0) saveLocalPref(PACK_TOPIC_KEY, v.trim());
                    else saveLocalPref(PACK_TOPIC_KEY, null);
                  }}
                  maxLength={120}
                  placeholder={t("aiTopicPlaceholder")}
                  className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="q-ai-count"
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {t("aiCountLabel")}
                </label>
                <input
                  id="q-ai-count"
                  type="number"
                  min={1}
                  max={100}
                  value={aiCount}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setAiCount(n);
                    if (Number.isFinite(n) && n >= 1 && n <= 100)
                      saveLocalPref(PACK_COUNT_KEY, Math.floor(n));
                    else saveLocalPref(PACK_COUNT_KEY, null);
                  }}
                  className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg border bg-white p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {builtPackAiPrompt()}
            </pre>
            <details className="rounded-lg border px-2 py-1">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 select-none dark:text-slate-400">
                {t("aiFormatSummary")}
              </summary>
              <p className="mt-1 text-[11px] whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                {QUESTION_PACK_FORMAT_GUIDE}
              </p>
            </details>
            <button
              type="button"
              onClick={copyPackAiPrompt}
              className="rounded-md bg-gradient-to-r from-blue-600 to-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-soft)] transition hover:-translate-y-px hover:shadow-[var(--shadow-lift)]"
            >
              {aiCopied ? t("aiCopied") : t("copyAiPrompt")}
            </button>
          </div>
        </details>
        <textarea
          id="q-pack"
          rows={8}
          value={pack}
          onChange={(e) => {
            setPack(e.target.value);
            setPackErrors([]);
          }}
          placeholder={"sc | Output dari print(2 ** 3)? | 6 | 8 | 9 | 5 | B | 10"}
          className="mt-2 w-full rounded-lg border px-3 py-2 font-mono text-sm"
        />
        {packErrors.length > 0 && (
          <ul role="status" className="mt-2 space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {packErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
        <button
          disabled={busy}
          className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {t("importPack")}
        </button>
      </form>
      <form onSubmit={onCreate} aria-label={t("newQuestionAria")} className="rounded-xl border p-4">
        <h2 className="font-semibold">{t("newQuestionTitle")}</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div>
            <label htmlFor="q-type" className="text-sm font-semibold">
              {t("typeLabel")}
            </label>
            <select
              id="q-type"
              value={type}
              onChange={(e) => setType(e.target.value as QuestionType)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              {TYPES.map((qt) => (
                <option key={qt} value={qt}>
                  {qt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="q-prompt" className="text-sm font-semibold">
              {t("promptLabel")}
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
        {needsOptions && (
          <div className="mt-2">
            <label htmlFor="q-options" className="text-sm font-semibold">
              {t("optionsLabel")}
            </label>
            <textarea
              id="q-options"
              rows={3}
              required
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={"3\n4\n5"}
              className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
            />
          </div>
        )}
        {/* Media embed pada butir soal (materi/kuis): youtube, pdf, web, video, image, audio. */}
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div>
            <label htmlFor="q-media-type" className="text-sm font-semibold">
              {t("mediaLabel")}
            </label>
            <select
              id="q-media-type"
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              <option value="">{t("mediaNone")}</option>
              {["youtube", "pdf", "web", "video", "image", "audio"].map((mt) => (
                <option key={mt} value={mt}>
                  {mt}
                </option>
              ))}
            </select>
          </div>
          {mediaType && (
            <div>
              <label htmlFor="q-media-url" className="text-sm font-semibold">
                {t("mediaUrlLabel")}
              </label>
              <input
                id="q-media-url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </div>
          )}
        </div>
        <button
          disabled={busy}
          className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {t("add")}
        </button>
      </form>

      <form onSubmit={onVersion} aria-label={t("versionAria")} className="rounded-xl border p-4">
        <h2 className="font-semibold">{t("versionTitle")}</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <div>
            <label htmlFor="v-q" className="text-sm font-semibold">
              {t("questionLabel")}
            </label>
            <select
              id="v-q"
              required
              value={versionQ}
              onChange={(e) => setVersionQ(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              <option value="">{t("selectPrompt")}</option>
              {initialQuestions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.type} — {q.promptText.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="v-points" className="text-sm font-semibold">
              {t("pointsLabel")}
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
          {t("keyLabel")}
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
          {t("publish")}
        </button>
      </form>

      <section aria-label={t("listAria")} className="space-y-2">
        {initialQuestions.length === 0 && (
          <p className="rounded-xl border p-4 text-slate-600">{t("bankEmpty")}</p>
        )}
        {initialQuestions.map((q) => {
          const last = q.versions[q.versions.length - 1] ?? null;
          return (
            <div key={q.id} className="rounded-xl border p-3 text-sm">
              <p>
                <strong>{q.type}</strong> · {q.promptText}
              </p>
              <p className="text-slate-500">
                {q.versions.length === 0
                  ? t("noVersions")
                  : q.versions.map((v) => `v${v.version} (${v.points}p)`).join(", ")}
              </p>
              {last && (
                <RubricEditor
                  questionType={q.type}
                  versionId={last.id}
                  versionNumber={last.version}
                  existing={last.rubric}
                  lang={lang}
                />
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
