"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCohort, enrollStudent, suspendEnrollment } from "@/features/actions";
import type { CohortInfo } from "./page";

export function CohortManager({
  initialCohorts,
  courses,
}: {
  initialCohorts: CohortInfo[];
  courses: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [year, setYear] = useState("2026/2027");
  const [enroll, setEnroll] = useState<Record<string, { student: string; course: string }>>({});

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createCohort({ name, academicYear: year });
    setBusy(false);
    setNotice(res.ok ? `Cohort dibuat: ${res.cohortId}.` : `Gagal: ${res.error}`);
    if (res.ok) {
      setName("");
      router.refresh();
    }
  }

  function setEnrollField(cohortId: string, field: "student" | "course", value: string) {
    setEnroll((s) => ({
      ...s,
      [cohortId]: { ...(s[cohortId] ?? { student: "", course: "" }), [field]: value },
    }));
  }

  async function onEnroll(e: React.FormEvent, cohortId: string) {
    e.preventDefault();
    const f = enroll[cohortId];
    if (!f?.student || !f?.course) {
      setNotice("Isi student ID dan course.");
      return;
    }
    setBusy(true);
    const res = await enrollStudent({ courseId: f.course, studentId: f.student, cohortId });
    setBusy(false);
    setNotice(res.ok ? "Murid di-enroll." : `Gagal: ${res.error} (pastikan UUID murid benar)`);
    if (res.ok) router.refresh();
  }

  async function onSuspend(enrollmentId: string) {
    if (!window.confirm("Suspend enrollment ini?")) return;
    setBusy(true);
    const res = await suspendEnrollment({ enrollmentId });
    setBusy(false);
    setNotice(res.ok ? "Enrollment di-suspend." : `Gagal: ${res.error}`);
    if (res.ok) router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      {notice && (
        <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">
          {notice}
        </p>
      )}
      <form
        onSubmit={onCreate}
        aria-label="Buat cohort"
        className="flex flex-wrap items-end gap-2 rounded-xl border p-4"
      >
        <div>
          <label htmlFor="cohort-name" className="text-sm font-semibold">
            Nama cohort
          </label>
          <input
            id="cohort-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={3}
            maxLength={200}
            className="mt-1 block rounded-lg border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="cohort-year" className="text-sm font-semibold">
            Tahun ajaran
          </label>
          <input
            id="cohort-year"
            required
            value={year}
            onChange={(e) => setYear(e.target.value)}
            minLength={4}
            maxLength={20}
            className="mt-1 block rounded-lg border px-3 py-2"
          />
        </div>
        <button
          disabled={busy}
          className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          Buat
        </button>
      </form>

      {initialCohorts.length === 0 && (
        <p className="rounded-xl border p-4" role="status">
          Belum ada cohort.
        </p>
      )}
      {initialCohorts.map((c) => (
        <section key={c.id} aria-label={c.name} className="rounded-xl border p-4">
          <h2 className="font-bold">
            {c.name} <span className="text-sm font-normal text-slate-500">({c.academicYear})</span>
            <a
              href={`/api/export/cohorts/${c.id}`}
              className="ml-2 text-sm font-semibold text-blue-700 underline"
            >
              Ekspor roster (CSV)
            </a>
          </h2>
          <h3 className="mt-3 text-sm font-semibold">Anggota ({c.members.length})</h3>
          <ul className="mt-1 text-sm">
            {c.members.map((m) => (
              <li key={m.studentId}>
                {m.displayName} · {m.status} · <span className="font-mono text-xs">{m.studentId}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-3 text-sm font-semibold">Enrollments</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {c.enrollments.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded border px-2 py-1">
                <span>
                  {e.studentName} · {e.courseTitle} · <strong>{e.status}</strong>
                </span>
                {e.status === "active" && (
                  <button
                    disabled={busy}
                    onClick={() => onSuspend(e.id)}
                    className="rounded border px-2 py-1 text-xs text-red-700"
                  >
                    Suspend
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => onEnroll(e, c.id)}
            aria-label={`Enroll ke ${c.name}`}
            className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3"
          >
            <div>
              <label htmlFor={`st-${c.id}`} className="text-xs font-semibold">
                Student ID (UUID)
              </label>
              <input
                id={`st-${c.id}`}
                required
                value={enroll[c.id]?.student ?? ""}
                onChange={(e) => setEnrollField(c.id, "student", e.target.value)}
                className="mt-1 block w-64 rounded border px-2 py-1 font-mono text-xs"
              />
            </div>
            <div>
              <label htmlFor={`co-${c.id}`} className="text-xs font-semibold">
                Course
              </label>
              <select
                id={`co-${c.id}`}
                required
                value={enroll[c.id]?.course ?? ""}
                onChange={(e) => setEnrollField(c.id, "course", e.target.value)}
                className="mt-1 block rounded border px-2 py-1 text-sm"
              >
                <option value="">— pilih —</option>
                {courses.map((co) => (
                  <option key={co.id} value={co.id}>
                    {co.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              disabled={busy}
              className="rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
            >
              Enroll
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
