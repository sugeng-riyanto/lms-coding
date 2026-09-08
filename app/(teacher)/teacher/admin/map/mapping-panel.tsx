"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignTeacherToClass, saveStudentMapping } from "@/features/actions";
import type { AdminMapData } from "./page";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { ADMIN_MAP } from "@/lib/ui-text/admin-map";

const ERR_KEY: Record<string, keyof typeof ADMIN_MAP> = {
  INVALID_INPUT: "errInvalidInput",
  FORBIDDEN: "errForbidden",
  NOT_FOUND_OR_FORBIDDEN: "errStudentNotFound",
  TEACHER_NOT_FOUND: "errTeacherNotFound",
  CLASS_NOT_FOUND: "errClassNotFound",
  UPDATE_FAILED: "errUpdateFailed",
};

export function MappingPanel({ data, lang }: { data: AdminMapData; lang: Lang }) {
  const t = mkT(ADMIN_MAP, lang);
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [cohortIds, setCohortIds] = useState<string[]>([]);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function toggle(set: string[], value: string, setter: (v: string[]) => void) {
    setter(set.includes(value) ? set.filter((x) => x !== value) : [...set, value]);
  }

  async function onSaveStudent() {
    if (!studentId) {
      setNotice(t("pickStudentFirst"));
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await saveStudentMapping({ studentId, cohortIds, courseIds });
    setBusy(false);
    if (res.ok) {
      const invalid = [...res.invalidCohorts, ...res.invalidCourses];
      setNotice(
        fmt(t("savedSummary"), { members: res.cohortMemberships, enrollments: res.enrollments }) +
          (invalid.length > 0 ? ` ${fmt(t("ignoredInvalid"), { count: invalid.length })}` : ""),
      );
      router.refresh();
    } else {
      const key = res.error ? ERR_KEY[res.error] : undefined;
      setNotice(fmt(t("failPrefix"), { error: key ? t(key) : res.error }));
    }
  }

  async function onAssignTeacher() {
    if (!teacherId || !classId) {
      setNotice(t("pickTeacherFirst"));
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await assignTeacherToClass({ teacherId, cohortId: classId });
    setBusy(false);
    const key = res.error ? ERR_KEY[res.error] : undefined;
    setNotice(res.ok ? t("teacherAssigned") : fmt(t("failPrefix"), { error: key ? t(key) : res.error }));
    router.refresh();
  }

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <section aria-label={t("studentAria")} className="rounded-xl border p-4">
        <h2 className="text-lg font-semibold">{t("studentTitle")}</h2>
        <label htmlFor="map-student" className="mt-3 block text-sm font-semibold">
          {t("studentLabel")}
        </label>
        <select
          id="map-student"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        >
          <option value="">{t("selectStudent")}</option>
          {data.students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>

        <p className="mt-3 text-sm font-semibold">{t("classesLabel")}</p>
        {data.cohorts.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noClasses")}</p>
        ) : (
          <ul className="mt-1 grid grid-cols-2 gap-1 text-sm">
            {data.cohorts.map((c) => (
              <li key={c.id}>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={cohortIds.includes(c.id)}
                    onChange={() => toggle(cohortIds, c.id, setCohortIds)}
                  />
                  {c.name}
                </label>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-sm font-semibold">{t("subjectsLabel")}</p>
        {data.courses.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noSubjects")}</p>
        ) : (
          <ul className="mt-1 grid grid-cols-2 gap-1 text-sm">
            {data.courses.map((c) => (
              <li key={c.id}>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={courseIds.includes(c.id)}
                    onChange={() => toggle(courseIds, c.id, setCourseIds)}
                  />
                  {c.title}
                </label>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onSaveStudent}
          disabled={busy}
          className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? t("saving") : t("saveStudent")}
        </button>
        <p className="mt-1 text-xs text-slate-500">{t("studentHint")}</p>
      </section>

      <section aria-label={t("teacherAria")} className="rounded-xl border p-4">
        <h2 className="text-lg font-semibold">{t("teacherTitle")}</h2>
        <label htmlFor="map-teacher" className="mt-3 block text-sm font-semibold">
          {t("teacherLabel")}
        </label>
        <select
          id="map-teacher"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        >
          <option value="">{t("selectTeacher")}</option>
          {data.teachers.map((tc) => (
            <option key={tc.id} value={tc.id}>
              {tc.displayName}
            </option>
          ))}
        </select>
        <label htmlFor="map-class" className="mt-3 block text-sm font-semibold">
          {t("classLabel")}
        </label>
        <select
          id="map-class"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        >
          <option value="">{t("selectClass")}</option>
          {data.cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAssignTeacher}
          disabled={busy}
          className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? t("saving") : t("assignTeacher")}
        </button>
        <p className="mt-1 text-xs text-slate-500">{t("teacherHint")}</p>
      </section>

      {notice && (
        <p role="status" className="md:col-span-2 text-sm">
          {notice}
        </p>
      )}
    </div>
  );
}
