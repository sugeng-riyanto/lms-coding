"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createActivity, createLesson, createModule, reorderSiblings } from "@/features/actions";
import { EditNode } from "@/components/edit-node";

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
] as const;

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

  function fail(text: string) {
    setNotice({ kind: "err", text });
    setBusy(false);
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
    try {
      const parsedJson: unknown = JSON.parse(actContent || "{}");
      if (typeof parsedJson !== "object" || parsedJson === null || Array.isArray(parsedJson)) {
        return fail("Konten harus objek JSON.");
      }
      content = parsedJson as Record<string, unknown>;
    } catch {
      return fail("Konten bukan JSON valid.");
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
            Konten JSON (body/url/transcript/placeId/instruction/expectedEvidence)
          </label>
          <textarea
            id="a-content"
            rows={2}
            value={actContent}
            onChange={(e) => setActContent(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs"
          />
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
