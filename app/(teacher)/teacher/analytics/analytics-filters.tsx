"use client";

import { useRouter } from "next/navigation";

export function AnalyticsFilters({
  cohorts,
  assessments,
  selectedCohort,
  selectedAssessment,
}: {
  cohorts: { id: string; name: string }[];
  assessments: { id: string; title: string }[];
  selectedCohort: string;
  selectedAssessment: string;
}) {
  const router = useRouter();

  function update(key: "cohortId" | "assessmentId", value: string) {
    const p = new URLSearchParams({ cohortId: selectedCohort, assessmentId: selectedAssessment });
    p.set(key, value);
    router.push(`/teacher/analytics?${p.toString()}`);
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border p-3"
    >
      <div>
        <label htmlFor="analytics-cohort" className="text-sm font-semibold">
          Cohort
        </label>
        <select
          id="analytics-cohort"
          value={selectedCohort}
          onChange={(e) => update("cohortId", e.target.value)}
          className="mt-1 rounded-lg border px-3 py-2 text-sm"
        >
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="analytics-assessment" className="text-sm font-semibold">
          Assessment
        </label>
        <select
          id="analytics-assessment"
          value={selectedAssessment}
          onChange={(e) => update("assessmentId", e.target.value)}
          className="mt-1 rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">Semua assessment</option>
          {assessments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
