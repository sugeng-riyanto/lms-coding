"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createActivity, createLesson, createModule, reorderSiblings } from "@/features/actions";
import { EditNode } from "@/components/edit-node";
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
] as const;

/** Petunjuk isian JSON per tipe aktivitas (dokumentasi ringkas di UI authoring). */
const CONTENT_HINTS: Record<string, string> = {
  article:
    'Markdown mentah (tanpa kurung kurawal) — # judul, ``` kode, ![alt](url) gambar, teks → paragraf. \nJSON juga tetap diterima: {"blocks":[…]} atau {"body":"teks polos"}',
  video_link: '{"url": "https://…", "transcript": "Transkrip aksesibel"}',
  resource: '{"url": "https://…"}',
  reflection: "{}",
  quiz: "{}",
  assignment_upload: "{}",
  roblox_challenge: '{"placeId": "…", "instruction": "…"}',
  code_board:
    '{"code": "print(\'Halo dunia\')", "language": "python", "transcript": "Penjelasan alternatif"}',
  embed_youtube: '{"url": "https://www.youtube.com/watch?v=ID"}',
  embed_pdf: '{"url": "https://…/materi.pdf", "title": "Opsional"}',
  embed_audio: '{"url": "https://…/audio.mp3", "transcript": "Transkrip"}',
  embed_file: '{"url": "https://…/berkas.zip", "title": "Nama berkas"}',
};

export function LevelManager({
  levelId,
  initialModules,
}: {
  levelId: string;
  initialModules: ManagerModule[];
}) {
  const router = useRouter();
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
    const t = window.setTimeout(() => {
      const stored = loadLocalPref<string>(ARTICLE_TOPIC_KEY);
      if (stored && stored.trim().length > 0) {
        setAiTopic(stored);
        setAiTopicEdited(true);
      }
    }, 0);
    return () => window.clearTimeout(t);
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
    if (!res.ok) return fail(`Gagal tambah module: ${res.error}`);
    setModuleTitle("");
    setNotice({ kind: "ok", text: "Module ditambahkan." });
    setBusy(false);
    router.refresh();
  }

  async function onAddLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonModule) return fail("Pilih module dulu.");
    setBusy(true);
    const res = await createLesson({
      moduleId: lessonModule,
      title: lessonTitle,
      objective: lessonObjective,
    });
    if (!res.ok) return fail(`Gagal tambah lesson: ${res.error}`);
    setLessonTitle("");
    setLessonObjective("");
    setNotice({ kind: "ok", text: "Lesson ditambahkan." });
    setBusy(false);
    router.refresh();
  }

  async function onAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!actLesson) return fail("Pilih lesson dulu.");
    let content: Record<string, unknown> = {};
    const raw = actContent.trim();
    try {
      const parsedJson: unknown = JSON.parse(raw || "{}");
      if (typeof parsedJson !== "object" || parsedJson === null || Array.isArray(parsedJson)) {
        return fail("Konten harus objek JSON.");
      }
      content = parsedJson as Record<string, unknown>;
    } catch {
      // Article menerima MARKDOWN mentah (tanpa kurung kurawal) — di-server
      // diubah jadi blok ter-allowlist (lib/markdown-blocks).
      if (actType !== "article" || raw.length === 0) return fail("Konten bukan JSON valid.");
      content = { markdown: raw };
    }
    setBusy(true);
    const res = await createActivity({ lessonId: actLesson, type: actType, title: actTitle, content });
    if (!res.ok) return fail(`Gagal tambah activity: ${res.error}`);
    setActTitle("");
    setActContent("{}");
    setNotice({ kind: "ok", text: "Activity ditambahkan." });
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
    if (!res.ok) fail(`Gagal reorder: ${res.error}`);
    else {
      setNotice({ kind: "ok", text: "Urutan diperbarui." });
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
        <form onSubmit={onAddModule} aria-label="Tambah module" className="rounded-xl border p-4">
          <h2 className="font-semibold">+ Module</h2>
          <label htmlFor="m-title" className="mt-2 block text-sm font-semibold">
            Judul
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
            Tambah
          </button>
        </form>

        <form onSubmit={onAddLesson} aria-label="Tambah lesson" className="rounded-xl border p-4">
          <h2 className="font-semibold">+ Lesson</h2>
          <label htmlFor="l-module" className="mt-2 block text-sm font-semibold">
            Module
          </label>
          <select
            id="l-module"
            required
            value={lessonModule}
            onChange={(e) => setLessonModule(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            <option value="">— pilih —</option>
            {initialModules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          <label htmlFor="l-title" className="mt-2 block text-sm font-semibold">
            Judul
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
            Objective (min 10 karakter)
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
            Tambah
          </button>
        </form>

        <form onSubmit={onAddActivity} aria-label="Tambah activity" className="rounded-xl border p-4">
          <h2 className="font-semibold">+ Activity</h2>
          <label htmlFor="a-lesson" className="mt-2 block text-sm font-semibold">
            Lesson
          </label>
          <select
            id="a-lesson"
            required
            value={actLesson}
            onChange={(e) => setActLesson(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            <option value="">— pilih —</option>
            {allLessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.moduleTitle} / {l.title}
              </option>
            ))}
          </select>
          <label htmlFor="a-type" className="mt-2 block text-sm font-semibold">
            Tipe
          </label>
          <select
            id="a-type"
            value={actType}
            onChange={(e) => setActType(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label htmlFor="a-title" className="mt-2 block text-sm font-semibold">
            Judul
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
            Konten {actType === "article" ? "Markdown (atau JSON)" : "JSON"}
          </label>
          <textarea
            id="a-content"
            rows={2}
            value={actContent}
            onChange={(e) => setActContent(e.target.value)}
            placeholder={CONTENT_HINTS[actType] ?? "{}"}
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs"
          />
          <p className="mt-1 text-xs text-slate-500">Contoh: {CONTENT_HINTS[actType] ?? "{}"}</p>
          {actType === "article" && (
            <details className="mt-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/40">
              <summary className="cursor-pointer text-xs font-semibold text-blue-800 select-none dark:text-blue-300">
                🤖 Template prompt AI + format materi
              </summary>{" "}
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Salin prompt di bawah, kirim ke AI bersama teks sumber (mis. halaman tutorial yang
                  diadopsi). AI mengembalikan Markdown yang langsung diterima platform — tempel hasilnya ke
                  kolom konten di atas.
                </p>
                <div>
                  <label
                    htmlFor="ai-topic"
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Topik materi (opsional — prompt otomatis dipersonalisasi)
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
                    placeholder="Mis. Perulangan for di Python"
                    className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    Terisi otomatis dari judul activity — boleh diganti manual.
                  </p>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg border bg-white p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {builtAiPrompt()}
                </pre>
                <details className="rounded-lg border px-2 py-1">
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 select-none dark:text-slate-400">
                    Lihat ringkasan format (aturan cepat)
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
                  {aiCopied ? "Tersalin ✓" : "Salin prompt AI"}
                </button>
              </div>
            </details>
          )}
          <button
            disabled={busy}
            className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            Tambah
          </button>
        </form>
      </div>

      <section aria-label="Struktur konten" className="space-y-4">
        {initialModules.length === 0 && (
          <p className="rounded-xl border p-5 text-slate-600">Belum ada module.</p>
        )}
        {initialModules.map((m) => (
          <div key={m.id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Module: {m.title}</h2>
              <EditNode table="modules" id={m.id} initialTitle={m.title} />
            </div>
            {m.lessons.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">Belum ada lesson.</p>
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
                        />
                        <button
                          disabled={busy || i === 0}
                          aria-label={`Naikkan ${le.title}`}
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
                          aria-label={`Turunkan ${le.title}`}
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
                                Assessment
                              </Link>
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <EditNode table="activities" id={a.id} initialTitle={a.title} />
                            <button
                              disabled={busy || ai === 0}
                              aria-label={`Naikkan ${a.title}`}
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
                              aria-label={`Turunkan ${a.title}`}
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
