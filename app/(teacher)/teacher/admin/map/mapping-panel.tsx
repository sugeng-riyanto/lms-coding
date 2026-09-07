"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignTeacherToClass, saveStudentMapping } from "@/features/actions";
import type { AdminMapData } from "./page";

const ERR_TEXT: Record<string, string> = {
  INVALID_INPUT: "Data tidak valid.",
  FORBIDDEN: "Aksi ini hanya untuk admin org (guru pemilik course).",
  NOT_FOUND_OR_FORBIDDEN: "Murid tidak ditemukan di organisasi ini.",
  TEACHER_NOT_FOUND: "Guru tidak ditemukan sebagai guru aktif di org ini.",
  CLASS_NOT_FOUND: "Kelas tidak ditemukan di org ini.",
  UPDATE_FAILED: "Gagal memperbarui kelas.",
};

export function MappingPanel({ data }: { data: AdminMapData }) {
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
      setNotice("Pilih murid dulu.");
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await saveStudentMapping({ studentId, cohortIds, courseIds });
    setBusy(false);
    if (res.ok) {
      const invalid = [...res.invalidCohorts, ...res.invalidCourses];
      setNotice(
        `${res.cohortMemberships} keanggotaan kelas · ${res.enrollments} enrollment subjek.` +
          (invalid.length > 0 ? ` ${invalid.length} id tak valid diabaikan.` : ""),
      );
      router.refresh();
    } else {
      setNotice(`Gagal: ${ERR_TEXT[res.error] ?? res.error}`);
    }
  }

  async function onAssignTeacher() {
    if (!teacherId || !classId) {
      setNotice("Pilih guru dan kelas dulu.");
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await assignTeacherToClass({ teacherId, cohortId: classId });
    setBusy(false);
    setNotice(res.ok ? "Guru pengampu kelas diperbarui." : `Gagal: ${ERR_TEXT[res.error] ?? res.error}`);
    router.refresh();
  }

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <section aria-label="Mapping murid" className="rounded-xl border p-4">
        <h2 className="text-lg font-semibold">Mapping murid → kelas &amp; subjek</h2>
        <label htmlFor="map-student" className="mt-3 block text-sm font-semibold">
          Murid
        </label>
        <select
          id="map-student"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        >
          <option value="">— pilih murid —</option>
          {data.students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>

        <p className="mt-3 text-sm font-semibold">Kelas (cohort)</p>
        {data.cohorts.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada kelas.</p>
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

        <p className="mt-3 text-sm font-semibold">Subjek (course)</p>
        {data.courses.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada subjek.</p>
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
          {busy ? "Menyimpan…" : "Simpan mapping murid"}
        </button>
        <p className="mt-1 text-xs text-slate-500">
          Subjek di-enroll di setiap kelas yang dipilih (grid kelas × subjek).
        </p>
      </section>

      <section aria-label="Mapping guru" className="rounded-xl border p-4">
        <h2 className="text-lg font-semibold">Guru pengampu kelas</h2>
        <label htmlFor="map-teacher" className="mt-3 block text-sm font-semibold">
          Guru
        </label>
        <select
          id="map-teacher"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        >
          <option value="">— pilih guru —</option>
          {data.teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
            </option>
          ))}
        </select>
        <label htmlFor="map-class" className="mt-3 block text-sm font-semibold">
          Kelas
        </label>
        <select
          id="map-class"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        >
          <option value="">— pilih kelas —</option>
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
          {busy ? "Menyimpan…" : "Tetapkan guru ke kelas"}
        </button>
        <p className="mt-1 text-xs text-slate-500">
          Menetapkan guru akan memindahkan kelas ke pengampu baru.
        </p>
      </section>

      {notice && (
        <p role="status" className="md:col-span-2 text-sm">
          {notice}
        </p>
      )}
    </div>
  );
}
