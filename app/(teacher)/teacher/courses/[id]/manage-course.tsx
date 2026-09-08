"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  archiveCourse,
  createCourseVersion,
  createLevel,
  duplicateCourse,
  publishCourseVersion,
  reorderSiblings,
} from "@/features/actions";
import { EditNode } from "@/components/edit-node";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { COURSE } from "@/lib/ui-text/course";
import type { PublishIssue } from "@/lib/publish-validation";

export interface ManageLevel {
  id: string;
  position: number;
  title: string;
  objective: string;
}

export function ManageCourse({
  courseId,
  versionId,
  initialLevels,
  lang,
}: {
  courseId: string;
  versionId: string;
  initialLevels: ManageLevel[];
  lang: Lang;
}) {
  const router = useRouter();
  const t = mkT(COURSE, lang);
  const [levels, setLevels] = useState<ManageLevel[]>(initialLevels);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [issues, setIssues] = useState<PublishIssue[]>([]);
  const [slug, setSlug] = useState("");
  const [levelTitle, setLevelTitle] = useState("");
  const [levelObjective, setLevelObjective] = useState("");

  async function onAddLevel(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add-level");
    const res = await createLevel({
      courseVersionId: versionId,
      title: levelTitle,
      objective: levelObjective,
    });
    setBusy(null);
    if (!res.ok) {
      setNotice({ kind: "err", text: fmt(t("addLevelFailed"), { error: res.error }) });
    } else {
      setLevelTitle("");
      setLevelObjective("");
      setNotice({ kind: "ok", text: t("levelAdded") });
      router.refresh();
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...levels];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const a = next[index];
    const b = next[j];
    if (!a || !b) return;
    next[index] = b;
    next[j] = a;
    setLevels(next);
    setBusy("reorder");
    const res = await reorderSiblings({
      table: "levels",
      parentColumn: "course_version_id",
      parentId: versionId,
      orderedIds: next.map((l) => l.id),
    });
    setBusy(null);
    if (!res.ok) {
      setLevels(initialLevels);
      setNotice({ kind: "err", text: fmt(t("reorderFailed"), { error: res.error }) });
    } else {
      router.refresh();
    }
  }

  async function onPublish() {
    setBusy("publish");
    setIssues([]);
    const res = await publishCourseVersion({ courseId });
    setBusy(null);
    if (res.ok) {
      setNotice({ kind: "ok", text: fmt(t("versionPublished"), { version: res.version }) });
      router.refresh();
    } else if (res.error === "VALIDATION_FAILED") {
      setIssues("issues" in res && Array.isArray(res.issues) ? res.issues : []);
      setNotice({ kind: "err", text: t("validationFailed") });
    } else {
      setNotice({ kind: "err", text: fmt(t("publishFailed"), { error: res.error }) });
    }
  }

  async function onDuplicate(e: React.FormEvent) {
    e.preventDefault();
    setBusy("duplicate");
    const res = await duplicateCourse({ courseId, slug });
    setBusy(null);
    if (res.ok) {
      setNotice({ kind: "ok", text: fmt(t("duplicateDone"), { courseId: res.courseId }) });
    } else {
      setNotice({ kind: "err", text: fmt(t("duplicateFailed"), { error: res.error }) });
    }
  }

  async function onArchive() {
    if (!window.confirm(t("archiveConfirm"))) return;
    setBusy("archive");
    const res = await archiveCourse({ courseId });
    setBusy(null);
    setNotice(
      res.ok
        ? { kind: "ok", text: t("archived") }
        : { kind: "err", text: fmt(t("failedGeneric"), { error: res.error }) },
    );
    if (res.ok) router.refresh();
  }

  async function onNewVersion() {
    setBusy("new-version");
    const res = await createCourseVersion({ courseId });
    setBusy(null);
    setNotice(
      res.ok
        ? {
            kind: "ok" as const,
            text: fmt(t("newVersionDone"), { version: res.version }),
          }
        : { kind: "err" as const, text: fmt(t("failedGeneric"), { error: res.error }) },
    );
    if (res.ok) router.refresh();
  }

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

      <section aria-label={t("levelSection")} className="rounded-xl border p-5">
        <h2 className="font-semibold">{t("levelSection")}</h2>
        <form
          onSubmit={onAddLevel}
          aria-label={t("addLevelForm")}
          className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3"
        >
          <div>
            <label htmlFor="lv-title" className="text-sm font-semibold">
              {t("levelTitleLabel")}
            </label>
            <input
              id="lv-title"
              required
              value={levelTitle}
              onChange={(e) => setLevelTitle(e.target.value)}
              minLength={3}
              maxLength={200}
              className="mt-1 block rounded-lg border px-3 py-2"
            />
          </div>
          <div className="min-w-52 flex-1">
            <label htmlFor="lv-obj" className="text-sm font-semibold">
              {t("objectiveLabel")}
            </label>
            <input
              id="lv-obj"
              required
              value={levelObjective}
              onChange={(e) => setLevelObjective(e.target.value)}
              minLength={10}
              maxLength={2000}
              className="mt-1 block w-full rounded-lg border px-3 py-2"
            />
          </div>
          <button
            disabled={busy !== null}
            className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {t("addLevelButton")}
          </button>
        </form>
        {levels.length === 0 ? (
          <p className="mt-2 text-slate-600">{t("noLevels")}</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {levels.map((l, i) => (
              <li key={l.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span>
                  <strong>{i + 1}.</strong> {l.title}
                </span>
                <span className="flex items-center gap-1">
                  <Link
                    href={`/teacher/courses/${courseId}/levels/${l.id}`}
                    className="rounded border px-2 py-1 text-sm text-blue-700 underline"
                  >
                    {t("manageContent")}
                  </Link>
                  <EditNode
                    table="levels"
                    id={l.id}
                    initialTitle={l.title}
                    initialObjective={l.objective}
                    showObjective
                    lang={lang}
                  />
                  <button
                    disabled={busy !== null || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={fmt(t("moveUp"), { title: l.title })}
                    className="rounded border px-2 py-1 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    disabled={busy !== null || i === levels.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={fmt(t("moveDown"), { title: l.title })}
                    className="rounded border px-2 py-1 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {issues.length > 0 && (
        <section aria-label={t("issuesSection")} className="rounded-xl border border-red-200 p-5">
          <h2 className="font-semibold text-red-800">{t("checklistHeading")}</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {issues.map((iss, i) => (
              <li key={i}>
                <span className="font-mono font-bold">{iss.code}</span> — {iss.message}{" "}
                <span className="text-slate-500">({iss.path})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        <button
          onClick={onPublish}
          disabled={busy !== null}
          className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {busy === "publish" ? t("validating") : t("validatePublish")}
        </button>
        <button
          onClick={onNewVersion}
          disabled={busy !== null}
          className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-60"
        >
          {busy === "new-version" ? t("copying") : t("newVersionButton")}
        </button>
        <button
          onClick={onArchive}
          disabled={busy !== null}
          className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-60"
        >
          {t("archiveButton")}
        </button>
        <a href="preview" className="rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50">
          {t("previewButton")}
        </a>
      </section>

      <form
        onSubmit={onDuplicate}
        aria-label={t("duplicateForm")}
        className="flex flex-wrap items-end gap-2 rounded-xl border p-5"
      >
        <div>
          <label htmlFor="dup-slug" className="font-semibold">
            {t("duplicateSlugLabel")}
          </label>
          <input
            id="dup-slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            pattern="[a-z0-9-]+"
            minLength={3}
            maxLength={80}
            className="mt-1 block rounded-lg border px-3 py-2"
            placeholder="matematika-dasar-v2"
          />
        </div>
        <button
          type="submit"
          disabled={busy !== null}
          className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-60"
        >
          {busy === "duplicate" ? t("copying") : t("duplicateButton")}
        </button>
      </form>
    </div>
  );
}
