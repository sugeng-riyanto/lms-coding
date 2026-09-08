"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createActivity, createLesson, createModule, reorderSiblings } from "@/features/actions";
import { EditNode } from "@/components/edit-node";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { LEVEL } from "@/lib/ui-text/level";
import { MARKDOWN_FORMAT_GUIDE, buildMarkdownAiPrompt } from "@/lib/markdown-ai-prompt";
import { loadLocalPref, saveLocalPref } from "@/lib/client-storage";

/** Pref perangkat: topik AI article terakhir (dipakai bila guru mengetik manual). */
const ARTICLE_TOPIC_KEY = "ai:article-topic";

export interface ManagerActivity {
  id: string;
  position: number;
  type: string;
  title: string;
}
export interface ManagerLesson {
  id: string;
  position: number;
  title: string;
  objective: string;
  activities: ManagerActivity[];
}
export interface ManagerModule {
  id: string;
  position: number;
  title: string;
  lessons: ManagerLesson[];
}

const ACTIVITY_TYPES = [
  "article",
  "video_link",
  "resource",
  "reflection",
  "quiz",
  "assignment_upload",
  "roblox_challenge",
  // LMS coding: blok kode + media ter-embed (migration 000014).
  "code_board",
  "embed_youtube",
  "embed_pdf",
  "embed_audio",
  "embed_file",
  // Media kaya (migration 000030): web interaktif (PhET/oPhysics) + video.
  "embed_web",
  "embed_video",
] as const;

/** Petunjuk isian JSON per tipe aktivitas (dokumentasi ringkas di UI authoring). */
function contentHints(t: (k: keyof typeof LEVEL) => string): Record<string, string> {
  return {
    article: t("hintArticle"),
    video_link: t("hintVideoLink"),
    resource: t("hintResource"),
    reflection: t("hintReflection"),
    quiz: t("hintQuiz"),
    assignment_upload: t("hintAssignmentUpload"),
    roblox_challenge: t("hintRoblox"),
    code_board: t("hintCodeBoard"),
    embed_youtube: t("hintEmbedYoutube"),
    embed_pdf: t("hintEmbedPdf"),
    embed_audio: t("hintEmbedAudio"),
    embed_file: t("hintEmbedFile"),
    embed_web: t("hintEmbedWeb"),
    embed_video: t("hintEmbedVideo"),
  };
}

export function LevelManager({
  levelId,
  initialModules,
  lang,
}: {
  levelId: string;
  initialModules: ManagerModule[];
  lang: Lang;
}) {
  const router = useRouter();
  const t = mkT(LEVEL, lang);
  const hints = contentHints(t);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonModule, setLessonModule] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonObjective, setLessonObjective] = useState("");
  const [actLesson, setActLesson] = useState("");
  const [actType, setActType] = useState<string>("article");
  const [actTitle, setActTitle] = useState("");
  const [actContent, setActContent] = useState("{}");
  const [aiCopied, setAiCopied] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiTopicEdited, setAiTopicEdited] = useState(false);

  // Auto-fill topik prompt AI dari judul activity/lesson yang diketik, SELAMA
  // guru belum mengedit topik secara manual (setelah diedit → tidak ditimpa).
  const aiTopicValue = aiTopicEdited ? aiTopic : actTitle.trim().slice(0, 120);

  // Pulihkan topik manual terakhir guru dari perangkat (setelah hidrasi).
  useEffect(() => {
    const tm = window.setTimeout(() => {
      const stored = loadLocalPref<string>(ARTICLE_TOPIC_KEY);
      if (stored && stored.trim().length > 0) {
        setAiTopic(stored);
        setAiTopicEdited(true);
      }
    }, 0);
    return () => window.clearTimeout(tm);
  }, []);

  function fail(text: string) {
    setNotice({ kind: "err", text });
    setBusy(false);
  }

  function builtAiPrompt(): string {
    return buildMarkdownAiPrompt({ topic: aiTopicValue.trim() || undefined });
  }

  async function copyAiPrompt() {
    const text = builtAiPrompt();
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

  async function onAddModule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createModule({ levelId, title: moduleTitle });
    if (!res.ok) return fail(fmt(t("addModuleFailed"), { error: res.error }));
    setModuleTitle("");
    setNotice({ kind: "ok", text: t("moduleAdded") });
    setBusy(false);
    router.refresh();
  }

  async function onAddLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonModule) return fail(t("pickModuleFirst"));
    setBusy(true);
    const res = await createLesson({
      moduleId: lessonModule,
      title: lessonTitle,
      objective: lessonObjective,
    });
    if (!res.ok) return fail(fmt(t("addLessonFailed"), { error: res.error }));
    setLessonTitle("");
    setLessonObjective("");
    setNotice({ kind: "ok", text: t("lessonAdded") });
    setBusy(false);
    router.refresh();
  }

  async function onAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!actLesson) return fail(t("pickLessonFirst"));
    let content: Record<string, unknown> = {};
    const raw = actContent.trim();
    try {
      const parsedJson: unknown = JSON.parse(raw || "{}");
      if (typeof parsedJson !== "object" || parsedJson === null || Array.isArray(parsedJson)) {
        return fail(t("contentMustBeJson"));
      }
      content = parsedJson as Record<string, unknown>;
    } catch {
      // Article menerima MARKDOWN mentah (tanpa kurung kurawal) — di-server
      // diubah jadi blok ter-allowlist (lib/markdown-blocks).
      if (actType !== "article" || raw.length === 0) return fail(t("contentNotValidJson"));
      content = { markdown: raw };
    }
    setBusy(true);
    const res = await createActivity({ lessonId: actLesson, type: actType, title: actTitle, content });
    if (!res.ok) return fail(fmt(t("addActivityFailed"), { error: res.error }));
    setActTitle("");
    setActContent("{}");
    setNotice({ kind: "ok", text: t("activityAdded") });
    setBusy(false);
    router.refresh();
  }

  async function move(
    kind: "lessons" | "activities",
    parentColumn: "module_id" | "lesson_id",
    parentId: string,
    ids: string[],
    index: number,
    dir: -1 | 1,
  ) {
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    const a = next[index];
    const b = next[j];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[j] = a;
    setBusy(true);
    const res = await reorderSiblings({
      table: kind,
      parentColumn,
      parentId,
      orderedIds: next,
    });
    if (!res.ok) fail(fmt(t("reorderFailed"), { error: res.error }));
    else {
      setNotice({ kind: "ok", text: t("orderUpdated") });
      setBusy(false);
      router.refresh();
    }
  }

  const allLessons = initialModules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));

  return (
    <div className="mt-6 space-y-6">
      {notice && (
        <p
          role={notice.kind === "err" ? "alert" : "status"}
          className={`rounded-lg p-3 ${notice.kind === "err" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}
        >
          {notice.text}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <form onSubmit={onAddModule} aria-label={t("addModuleTitle")} className="rounded-xl border p-4">
          <h2 className="font-semibold">{t("addModuleTitle")}</h2>
          <label htmlFor="m-title" className="mt-2 block text-sm font-semibold">
            {t("titleLabel")}
          </label>
          <input
            id="m-title"
            required
            value={moduleTitle}
            onChange={(e) => setModuleTitle(e.target.value)}
            minLength={3}
            maxLength={200}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
          <button
            disabled={busy}
            className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {t("addButton")}
          </button>
        </form>

        <form onSubmit={onAddLesson} aria-label={t("addLessonTitle")} className="rounded-xl border p-4">
          <h2 className="font-semibold">{t("addLessonTitle")}</h2>
          <label htmlFor="l-module" className="mt-2 block text-sm font-semibold">
            {t("moduleLabel")}
          </label>
          <select
            id="l-module"
            required
            value={lessonModule}
            onChange={(e) => setLessonModule(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            <option value="">{t("selectPlaceholder")}</option>
            {initialModules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          <label htmlFor="l-title" className="mt-2 block text-sm font-semibold">
            {t("titleLabel")}
          </label>
          <input
            id="l-title"
            required
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            minLength={3}
            maxLength={200}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
          <label htmlFor="l-obj" className="mt-2 block text-sm font-semibold">
            {t("objectiveLabel")}
          </label>
          <textarea
            id="l-obj"
            required
            value={lessonObjective}
            onChange={(e) => setLessonObjective(e.target.value)}
            minLength={10}
            rows={2}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
          <button
            disabled={busy}
            className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {t("addButton")}
          </button>
        </form>

        <form onSubmit={onAddActivity} aria-label={t("addActivityTitle")} className="rounded-xl border p-4">
          <h2 className="font-semibold">{t("addActivityTitle")}</h2>
          <label htmlFor="a-lesson" className="mt-2 block text-sm font-semibold">
            {t("lessonLabel")}
          </label>
          <select
            id="a-lesson"
            required
            value={actLesson}
            onChange={(e) => setActLesson(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            <option value="">{t("selectPlaceholder")}</option>
            {allLessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.moduleTitle} / {l.title}
              </option>
            ))}
          </select>
          <label htmlFor="a-type" className="mt-2 block text-sm font-semibold">
            {t("typeLabel")}
          </label>
          <select
            id="a-type"
            value={actType}
            onChange={(e) => setActType(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            {ACTIVITY_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {tp}
              </option>
            ))}
          </select>
          <label htmlFor="a-title" className="mt-2 block text-sm font-semibold">
            {t("titleLabel")}
          </label>
          <input
            id="a-title"
            required
            value={actTitle}
            onChange={(e) => setActTitle(e.target.value)}
            minLength={3}
            maxLength={200}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
          <label htmlFor="a-content" className="mt-2 block text-sm font-semibold">
            {actType === "article" ? t("contentLabelMarkdown") : t("contentLabelJson")}
          </label>
          <textarea
            id="a-content"
            rows={2}
            value={actContent}
            onChange={(e) => setActContent(e.target.value)}
            placeholder={hints[actType] ?? "{}"}
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs"
          />
          <p className="mt-1 text-xs text-slate-500">
            {t("examplePrefix")}
            {hints[actType] ?? "{}"}
          </p>
          {actType === "article" && (
            <details className="mt-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/40">
              <summary className="cursor-pointer text-xs font-semibold text-blue-800 select-none dark:text-blue-300">
                {t("aiPanelSummary")}
              </summary>{" "}
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">{t("aiPanelBody")}</p>
                <div>
                  <label
                    htmlFor="ai-topic"
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {t("aiTopicLabel")}
                  </label>
                  <input
                    id="ai-topic"
                    type="text"
                    value={aiTopicValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAiTopic(v);
                      setAiTopicEdited(true);
                      if (v.trim().length > 0) saveLocalPref(ARTICLE_TOPIC_KEY, v.trim());
                      else saveLocalPref(ARTICLE_TOPIC_KEY, null);
                    }}
                    maxLength={120}
                    placeholder={t("aiTopicPlaceholder")}
                    className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{t("aiTopicHint")}</p>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg border bg-white p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {builtAiPrompt()}
                </pre>
                <details className="rounded-lg border px-2 py-1">
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 select-none dark:text-slate-400">
                    {t("aiFormatSummary")}
                  </summary>
                  <p className="mt-1 text-[11px] whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                    {MARKDOWN_FORMAT_GUIDE}
                  </p>
                </details>
                <button
                  type="button"
                  onClick={copyAiPrompt}
                  className="rounded-md bg-gradient-to-r from-blue-600 to-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-soft)] transition hover:-translate-y-px hover:shadow-[var(--shadow-lift)]"
                >
                  {aiCopied ? t("copied") : t("copyPrompt")}
                </button>
              </div>
            </details>
          )}
          <button
            disabled={busy}
            className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {t("addButton")}
          </button>
        </form>
      </div>

      <section aria-label={t("structureSection")} className="space-y-4">
        {initialModules.length === 0 && (
          <p className="rounded-xl border p-5 text-slate-600">{t("noModules")}</p>
        )}
        {initialModules.map((m) => (
          <div key={m.id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{fmt(t("moduleHeading"), { title: m.title })}</h2>
              <EditNode table="modules" id={m.id} initialTitle={m.title} lang={lang} />
            </div>
            {m.lessons.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">{t("noLessons")}</p>
            ) : (
              <ol className="mt-2 space-y-2">
                {m.lessons.map((le, i) => (
                  <li key={le.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <span>
                        <strong>{i + 1}.</strong> {le.title}
                      </span>
                      <span className="flex items-center gap-1">
                        <EditNode
                          table="lessons"
                          id={le.id}
                          initialTitle={le.title}
                          initialObjective={le.objective}
                          showObjective
                          lang={lang}
                        />
                        <button
                          disabled={busy || i === 0}
                          aria-label={fmt(t("moveUp"), { title: le.title })}
                          onClick={() =>
                            move(
                              "lessons",
                              "module_id",
                              m.id,
                              m.lessons.map((x) => x.id),
                              i,
                              -1,
                            )
                          }
                          className="rounded border px-2 py-1 disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          disabled={busy || i === m.lessons.length - 1}
                          aria-label={fmt(t("moveDown"), { title: le.title })}
                          onClick={() =>
                            move(
                              "lessons",
                              "module_id",
                              m.id,
                              m.lessons.map((x) => x.id),
                              i,
                              1,
                            )
                          }
                          className="rounded border px-2 py-1 disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 pl-4">
                      {le.activities.map((a, ai) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between rounded border bg-white px-2 py-1 text-sm"
                        >
                          <span>
                            {a.title} <span className="text-slate-500">({a.type})</span>{" "}
                            {a.type === "quiz" && (
                              <Link href={`/teacher/assessments/${a.id}`} className="text-blue-700 underline">
                                {t("assessmentLink")}
                              </Link>
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <EditNode table="activities" id={a.id} initialTitle={a.title} lang={lang} />
                            <button
                              disabled={busy || ai === 0}
                              aria-label={fmt(t("moveUp"), { title: a.title })}
                              onClick={() =>
                                move(
                                  "activities",
                                  "lesson_id",
                                  le.id,
                                  le.activities.map((x) => x.id),
                                  ai,
                                  -1,
                                )
                              }
                              className="rounded border px-2 disabled:opacity-40"
                            >
                              ↑
                            </button>
                            <button
                              disabled={busy || ai === le.activities.length - 1}
                              aria-label={fmt(t("moveDown"), { title: a.title })}
                              onClick={() =>
                                move(
                                  "activities",
                                  "lesson_id",
                                  le.id,
                                  le.activities.map((x) => x.id),
                                  ai,
                                  1,
                                )
                              }
                              className="rounded border px-2 disabled:opacity-40"
                            >
                              ↓
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
