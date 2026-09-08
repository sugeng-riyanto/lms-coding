import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ITEM_METRIC_DEFINITIONS_VERSION,
  distractorMap,
  itemStatistics,
  type ItemResponseRow,
} from "@/lib/analytics-item";
import {
  CLASS_DISTRIBUTION_DEFINITIONS_VERSION,
  TEACHER_ANALYTICS_DEFINITIONS_VERSION,
  bottleneckAnalysis,
  buildTeacherDigest,
  percentDistribution,
  type DigestAlert,
} from "@/lib/analytics-teacher";
import { ChartPanel, ColumnChart } from "@/components/charts";
import { fmt, getLang, localeFor, mkT } from "@/lib/i18n";
import { ANALYTICS } from "@/lib/ui-text/analytics";
import { AnalyticsFilters } from "./analytics-filters";

export const dynamic = "force-dynamic";

type ChoiceType = "single_choice" | "true_false" | "multiple_choice";

// Modul-scope wrapper agar lint purity tidak memflag Date.now di render
// (pola sama dengan getDashboard di app/(student)/learn/page.tsx).
function currentEpochMs(): number {
  return Date.now();
}

function isChoiceType(t: string | undefined): t is ChoiceType {
  return t === "single_choice" || t === "true_false" || t === "multiple_choice";
}

function parseChosen(answer: unknown): string[] {
  if (typeof answer === "string") return [answer];
  if (Array.isArray(answer)) return answer.filter((a): a is string => typeof a === "string");
  return [];
}

function parseCorrect(grading: Record<string, unknown> | null | undefined): string[] {
  if (!grading) return [];
  const ids = grading.correctOptionIds;
  if (Array.isArray(ids)) return ids.filter((a): a is string => typeof a === "string");
  if (typeof grading.correctOptionId === "string") return [grading.correctOptionId];
  return [];
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ cohortId?: string; assessmentId?: string }>;
}) {
  const params = await searchParams;
  const lang = await getLang();
  const t = mkT(ANALYTICS, lang);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;

  const lastUpdated = new Date().toISOString();

  // Cohort milik guru ini (RLS + filter eksplisit).
  const { data: cohortRows } = await supabase
    .from("cohorts")
    .select("id,name")
    .eq("teacher_id", userId ?? "");
  const cohorts = (cohortRows as { id: string; name: string }[] | null) ?? [];
  const selectedCohort = cohorts.find((c) => c.id === params.cohortId)?.id ?? cohorts[0]?.id ?? null;

  if (cohorts.length === 0 || !selectedCohort) {
    return (
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800">
          {t("noCohort")}
        </p>
      </main>
    );
  }

  // ---- Data batch (tanpa N+1): enrollment → attempt → response → versi → soal ----
  // Catatan: tidak ada FK enrollments→profiles (PGRST200 pada embed) — ambil
  // display_name lewat query terpisah (pola sama seperti /teacher/certificates).
  const { data: enrRows } = await supabase
    .from("enrollments")
    .select("id,student_id,course_id,enrolled_at")
    .eq("cohort_id", selectedCohort)
    .eq("status", "active");
  const enrollments =
    (enrRows as
      | {
          id: string;
          student_id: string;
          course_id: string;
          enrolled_at: string;
        }[]
      | null) ?? [];
  const enrollmentIds = enrollments.map((e) => e.id);
  const studentIds = [...new Set(enrollments.map((e) => e.student_id))];
  const { data: profRows } =
    studentIds.length > 0
      ? await supabase.from("profiles").select("id,display_name").in("id", studentIds)
      : { data: [] as { id: string; display_name: string }[] };
  const studentName = new Map(
    ((profRows as { id: string; display_name: string }[] | null) ?? []).map((p) => [p.id, p.display_name]),
  );

  const { data: attemptRows } = await supabase
    .from("attempts")
    .select("id,assessment_id,enrollment_id,status,final_score")
    .in("enrollment_id", enrollmentIds);
  const attempts =
    (attemptRows as
      | {
          id: string;
          assessment_id: string;
          enrollment_id: string;
          status: string;
          final_score: number | null;
        }[]
      | null) ?? [];

  // Assessment untuk filter (hanya yang muncul di attempt cohort ini).
  const assessmentIds = [...new Set(attempts.map((a) => a.assessment_id))];
  const { data: asmtRows } = await supabase
    .from("assessments")
    .select("id,activity_id,activities(title)")
    .in("id", assessmentIds);
  const assessments =
    (asmtRows as { id: string; activity_id: string; activities: { title: string } | null }[] | null) ?? [];
  const selectedAssessment =
    params.assessmentId && assessments.some((a) => a.id === params.assessmentId)
      ? params.assessmentId
      : "all";

  const scopeAttempts = attempts.filter(
    (a) => selectedAssessment === "all" || a.assessment_id === selectedAssessment,
  );
  const attemptIds = scopeAttempts.map((a) => a.id);
  const attemptById = new Map(scopeAttempts.map((a) => [a.id, a]));

  const { data: respRows } = await supabase
    .from("responses")
    .select("attempt_id,question_version_id,answer_json")
    .in("attempt_id", attemptIds);
  const responses =
    (respRows as { attempt_id: string; question_version_id: string; answer_json: unknown }[] | null) ?? [];

  const versionIds = [...new Set(responses.map((r) => r.question_version_id))];
  const { data: qvRows } = await supabase
    .from("question_versions")
    .select("id,question_id,grading_json")
    .in("id", versionIds);
  const versions =
    (qvRows as { id: string; question_id: string; grading_json: Record<string, unknown> | null }[] | null) ??
    [];
  const versionById = new Map(versions.map((v) => [v.id, v]));

  const questionIds = [...new Set(versions.map((v) => v.question_id))];
  const { data: qRows } = await supabase
    .from("questions")
    .select("id,type,prompt_json")
    .in("id", questionIds);
  const questions =
    (qRows as
      { id: string; type: string; prompt_json: { text?: string; options?: string[] } | null }[] | null) ?? [];
  const questionById = new Map(questions.map((q) => [q.id, q]));

  // ---- Rakit baris flattened (di luar loop) ----
  const rows: ItemResponseRow[] = [];
  for (const r of responses) {
    const attempt = attemptById.get(r.attempt_id);
    if (!attempt) continue;
    const enrollment = enrollments.find((e) => e.id === attempt.enrollment_id);
    if (!enrollment) continue;
    const version = versionById.get(r.question_version_id);
    if (!version) continue;
    const question = questionById.get(version.question_id);
    if (!question || !isChoiceType(question.type)) continue;
    rows.push({
      questionId: version.question_id,
      attemptId: attempt.id,
      studentId: enrollment.student_id,
      displayName: studentName.get(enrollment.student_id) ?? "",
      questionType: question.type,
      promptText: question.prompt_json?.text ?? "",
      correctOptionIds: parseCorrect(version.grading_json),
      chosenOptionIds: parseChosen(r.answer_json),
      attemptStatus: attempt.status,
      assessmentTotalPct: Number(attempt.final_score ?? 0),
    });
  }

  const stats = itemStatistics(rows);
  const misconcepts = distractorMap(rows);
  const optionLabels = new Map<string, string[]>();
  for (const q of questions) {
    optionLabels.set(q.id, q.prompt_json?.options ?? []);
  }

  // ---- Bottleneck: lesson yang dibuka tapi tidak selesai ----
  const courseIds = [...new Set(enrollments.map((e) => e.course_id))];
  const { data: cvRows } = await supabase
    .from("course_versions")
    .select("id,course_id,version")
    .in("course_id", courseIds)
    .not("published_at", "is", null);
  const published = (cvRows as { id: string; course_id: string; version: number }[] | null) ?? [];
  const latestVersionByCourse = new Map<string, string>();
  for (const cv of [...published].sort((a, b) => b.version - a.version)) {
    if (!latestVersionByCourse.has(cv.course_id)) latestVersionByCourse.set(cv.course_id, cv.id);
  }
  const versionIdsForCourse = [...latestVersionByCourse.values()];
  const { data: levelRows } = await supabase
    .from("levels")
    .select("id,course_version_id")
    .in("course_version_id", versionIdsForCourse);
  const levelRowsTyped = (levelRows as { id: string; course_version_id: string }[] | null) ?? [];
  const levelIds = levelRowsTyped.map((l) => l.id);
  const { data: moduleRows } = await supabase.from("modules").select("id,level_id").in("level_id", levelIds);
  const moduleRowsTyped = (moduleRows as { id: string; level_id: string }[] | null) ?? [];
  const moduleIds = moduleRowsTyped.map((m) => m.id);
  const { data: lessonRows } = await supabase
    .from("lessons")
    .select("id,title,module_id")
    .in("module_id", moduleIds);
  const lessonRowsTyped = (lessonRows as { id: string; title: string; module_id: string }[] | null) ?? [];
  const lessons = lessonRowsTyped.map((l) => ({ id: l.id, title: l.title }));
  const lessonIds = lessons.map((l) => l.id);

  const { data: openedRows } = await supabase
    .from("learning_events")
    .select("entity_id,enrollment_id")
    .eq("event_type", "lesson_opened")
    .in("enrollment_id", enrollmentIds)
    .in("entity_id", lessonIds);
  const opened = (openedRows as { entity_id: string; enrollment_id: string }[] | null) ?? [];
  const { data: doneRows } = await supabase
    .from("progress_snapshots")
    .select("entity_id,enrollment_id,last_activity_at")
    .eq("entity_type", "lesson")
    .eq("status", "completed")
    .in("enrollment_id", enrollmentIds)
    .in("entity_id", lessonIds);
  const completed =
    (doneRows as { entity_id: string; enrollment_id: string; last_activity_at: string | null }[] | null) ??
    [];
  const bottlenecks = bottleneckAnalysis(
    lessons,
    opened.map((e) => ({ lessonId: e.entity_id, enrollmentId: e.enrollment_id })),
    completed.map((e) => ({ lessonId: e.entity_id, enrollmentId: e.enrollment_id })),
  );

  // ---- Digest mingguan: nilai manual, peringatan, murid tidak aktif ----
  const { data: pendingRows } = await supabase
    .from("attempts")
    .select("id")
    .in("enrollment_id", enrollmentIds)
    .eq("status", "needs_review");
  const pendingGrading = ((pendingRows as { id: string }[] | null) ?? []).length;

  const { data: alertRows } = await supabase
    .from("alerts")
    .select("id,message,created_at,status")
    .eq("cohort_id", selectedCohort)
    .neq("status", "resolved");
  const openAlerts: DigestAlert[] = (
    (alertRows as { id: string; message: string; created_at: string; status: string }[] | null) ?? []
  ).map((a) => ({
    id: a.id,
    message: a.message,
    createdAt: a.created_at,
    status: a.status,
  }));

  // Aktivitas terakhir per enrollment dari snapshot lesson; tanpa aktivitas
  // → bandingkan enrolled_at (murid baru tidak langsung dianggap tidak aktif).
  const lastActivityByEnr = new Map<string, number>();
  for (const c of completed) {
    if (!c.last_activity_at) continue;
    const tmpT = Date.parse(c.last_activity_at);
    const prev = lastActivityByEnr.get(c.enrollment_id) ?? 0;
    if (tmpT > prev) lastActivityByEnr.set(c.enrollment_id, tmpT);
  }
  const { data: allSnapRows } = await supabase
    .from("progress_snapshots")
    .select("enrollment_id,last_activity_at")
    .eq("entity_type", "lesson")
    .in("enrollment_id", enrollmentIds);
  for (const s of (allSnapRows as { enrollment_id: string; last_activity_at: string | null }[] | null) ??
    []) {
    if (!s.last_activity_at) continue;
    const tmpT = Date.parse(s.last_activity_at);
    const prev = lastActivityByEnr.get(s.enrollment_id) ?? 0;
    if (tmpT > prev) lastActivityByEnr.set(s.enrollment_id, tmpT);
  }
  const now = currentEpochMs();
  const WEEK_MS = 7 * 86_400_000;
  const inactiveStudents = enrollments
    .filter((e) => {
      const last = lastActivityByEnr.get(e.id);
      if (last === undefined) return now - Date.parse(e.enrolled_at) > WEEK_MS;
      return now - last > WEEK_MS;
    })
    .map((e) => ({
      studentId: e.student_id,
      displayName: studentName.get(e.student_id) ?? "",
      lastActivityAt: lastActivityByEnr.has(e.id)
        ? new Date(lastActivityByEnr.get(e.id)!).toISOString()
        : null,
    }));

  const digest = buildTeacherDigest(
    { pendingGrading, openAlerts, inactiveStudents, now: new Date(now) },
    lang,
  );

  // ---- Grafik DISTRIBUSI kelas: kemajuan per murid + skor asesmen ----
  // Lesson → module → level → course_version → course (semua dari hasil query
  // batch di atas, tanpa query tambahan & tanpa N+1).
  const levelCv = new Map(levelRowsTyped.map((l) => [l.id, l.course_version_id]));
  const cvCourse = new Map(published.map((cv) => [cv.id, cv.course_id]));
  const moduleLevel = new Map(moduleRowsTyped.map((m) => [m.id, m.level_id]));
  const lessonCourse = new Map<string, string>();
  for (const l of lessonRowsTyped) {
    const levelId = moduleLevel.get(l.module_id);
    const cvId = levelId ? levelCv.get(levelId) : undefined;
    const courseId = cvId ? cvCourse.get(cvId) : undefined;
    if (courseId) lessonCourse.set(l.id, courseId);
  }
  const lessonTotalByCourse = new Map<string, number>();
  for (const courseId of lessonCourse.values()) {
    lessonTotalByCourse.set(courseId, (lessonTotalByCourse.get(courseId) ?? 0) + 1);
  }
  const progressPcts: number[] = [];
  for (const e of enrollments) {
    const total = lessonTotalByCourse.get(e.course_id) ?? 0;
    if (total <= 0) continue;
    let doneForCourse = 0;
    for (const c of completed) {
      if (c.enrollment_id === e.id && lessonCourse.get(c.entity_id) === e.course_id) doneForCourse += 1;
    }
    progressPcts.push(Math.min(100, Math.round((doneForCourse / total) * 100)));
  }
  const progressDist = percentDistribution(progressPcts);

  // Skor asesmen (filter-aware): dari attempt final_score (0–100, server).
  const scoreValues = scopeAttempts
    .filter((a) => typeof a.final_score === "number")
    .map((a) => Number(a.final_score));
  const scoreDist = percentDistribution(scoreValues);

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const loc = localeFor(lang);
  const lastUpdatedDisplay = new Date(lastUpdated).toLocaleString(loc, { timeZone: "Asia/Jakarta" });
  const selectedAsmtLabel =
    selectedAssessment === "all"
      ? t("allScope")
      : (assessments.find((a) => a.id === selectedAssessment)?.activities?.title ?? t("selectedScope"));

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-slate-500">
          {fmt(t("cohortLabel"), { name: cohorts.find((c) => c.id === selectedCohort)?.name ?? "" })}
        </p>
      </div>

      {/* Digest mingguan: tiga prioritas tindakan */}
      <section aria-label={t("digestAria")} className="mt-4">
        <h2 className="text-lg font-semibold">{t("digestTitle")}</h2>
        <ul className="mt-2 grid gap-3 md:grid-cols-3">
          {digest.map((d) => (
            <li key={d.id} className="rounded-xl border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {fmt(t("priorityLabel"), { p: d.priority })}
              </p>
              <p className="mt-1 font-semibold">{d.title}</p>
              {d.detail && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{d.detail}</p>}
              <p className="mt-2 text-xs text-slate-500">{d.reason}</p>
              <Link href={d.href} className="mt-2 inline-block text-sm text-blue-700 underline">
                {t("open")}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <AnalyticsFilters
        cohorts={cohorts.map((c) => ({ id: c.id, name: c.name }))}
        assessments={assessments.map((a) => ({
          id: a.id,
          title: a.activities?.title ?? a.id.slice(0, 8),
        }))}
        selectedCohort={selectedCohort}
        selectedAssessment={selectedAssessment}
        lang={lang}
      />

      {/* Distribusi kelas — grafik nyata (data dari attempts & progress_snapshots) */}
      <section aria-label={t("distAria")} className="mt-6">
        <h2 className="text-xl font-bold">{t("distTitle")}</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <ChartPanel
            title={t("progressTitle")}
            desc={t("progressDesc")}
            updatedAt={lastUpdatedDisplay}
            footnote={fmt(t("progressFootnote"), {
              def: CLASS_DISTRIBUTION_DEFINITIONS_VERSION,
              n: progressDist.n,
              avg: Math.round(progressDist.meanPct),
            })}
            empty={progressDist.n === 0 ? t("progressEmpty") : undefined}
            lang={lang}
          >
            {progressDist.n > 0 && (
              <ColumnChart
                bars={progressDist.buckets.map((b) => ({ label: b.label, value: b.count }))}
                ariaLabel={t("progressAria")}
                tone="blue"
                lang={lang}
              />
            )}
          </ChartPanel>

          <ChartPanel
            title={t("scoreTitle")}
            desc={fmt(t("scoreDesc"), { scope: selectedAsmtLabel })}
            updatedAt={lastUpdatedDisplay}
            footnote={fmt(t("scoreFootnote"), {
              def: CLASS_DISTRIBUTION_DEFINITIONS_VERSION,
              n: scoreDist.n,
              avg: Math.round(scoreDist.meanPct),
            })}
            empty={scoreDist.n === 0 ? t("scoreEmpty") : undefined}
            lang={lang}
          >
            {scoreDist.n > 0 && (
              <ColumnChart
                bars={scoreDist.buckets.map((b) => ({ label: b.label, value: b.count }))}
                ariaLabel={t("scoreAria")}
                tone="amber"
                lang={lang}
              />
            )}
          </ChartPanel>
        </div>
      </section>

      {/* Item analysis */}
      <section aria-label={t("itemAria")} className="mt-6">
        <h2 className="text-lg font-semibold">{t("itemTitle")}</h2>
        {stats.length === 0 ? (
          <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {t("itemEmpty")}
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t("colQuestion")}</th>
                  <th className="px-3 py-2 font-semibold">{t("colType")}</th>
                  <th className="px-3 py-2 text-right font-semibold">n</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("colDifficulty")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("colOmit")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("colDiscrimination")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr
                    key={s.questionId}
                    className="border-b last:border-0 odd:bg-white dark:odd:bg-slate-900"
                  >
                    <td className="max-w-64 px-3 py-2">
                      <p className="truncate" title={s.promptText || t("noPromptText")}>
                        {s.promptText || t("noPromptFallback")}
                      </p>
                      <p className="text-xs text-slate-500">{s.questionId.slice(0, 8)}</p>
                    </td>
                    <td className="px-3 py-2">{s.questionType.replace("_", " ")}</td>
                    <td className="px-3 py-2 text-right">{s.n}</td>
                    <td className="px-3 py-2 text-right">{pct(s.difficulty)}</td>
                    <td className="px-3 py-2 text-right">{pct(s.omit)}</td>
                    <td className="px-3 py-2 text-right">
                      {s.discrimination === null ? (
                        <span title={t("discSmallTitle")}>—</span>
                      ) : (
                        <span title={t("discTitle")}>{pct(s.discrimination)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Misconception map */}
      <section aria-label={t("misconceptAria")} className="mt-6">
        <h2 className="text-lg font-semibold">{t("misconceptTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("misconceptDesc")}</p>
        {misconcepts.filter((m) => m.clusters.length > 0).length === 0 ? (
          <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {t("misconceptEmpty")}
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {misconcepts
              .filter((m) => m.clusters.length > 0)
              .map((m) => (
                <li key={m.questionId} className="rounded-xl border p-4">
                  <details>
                    <summary className="cursor-pointer font-semibold">
                      {fmt(t("misconceptSummary"), {
                        id: m.questionId.slice(0, 8),
                        n: m.n,
                        incorrect: m.incorrect,
                      })}
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {m.clusters.map((c) => (
                        <li key={c.optionId} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                          <p className="font-medium">
                            {fmt(t("optionLabel"), {
                              opt: c.optionId || t("emptyOption"),
                              picked: c.picked,
                              share: pct(c.shareOfIncorrect),
                            })}
                          </p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {t("students")}{" "}
                            {c.studentNames.length > 0 ? c.studentNames.join(", ") : c.studentIds.join(", ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Learning-path bottleneck */}
      <section aria-label={t("bottleneckAria")} className="mt-6">
        <h2 className="text-lg font-semibold">{t("bottleneckTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("bottleneckDesc")}</p>
        {bottlenecks.filter((b) => b.opened > 0).length === 0 ? (
          <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {t("bottleneckEmpty")}
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t("colLesson")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("colStarted")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("colCompleted")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("colDropoff")}</th>
                  <th className="px-3 py-2 font-semibold">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {bottlenecks
                  .filter((b) => b.opened > 0)
                  .map((b) => (
                    <tr
                      key={b.lessonId}
                      className="border-b last:border-0 odd:bg-white dark:odd:bg-slate-900"
                    >
                      <td className="px-3 py-2 font-medium">{b.title}</td>
                      <td className="px-3 py-2 text-right">{b.opened}</td>
                      <td className="px-3 py-2 text-right">{b.completed}</td>
                      <td className="px-3 py-2 text-right">{b.dropoff === null ? "—" : pct(b.dropoff)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            b.severity === "high"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100"
                              : b.severity === "watch"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"
                          }`}
                        >
                          {b.severity === "insufficient"
                            ? t("severitySmallN")
                            : b.severity === "high"
                              ? t("severityHigh")
                              : b.severity === "watch"
                                ? t("severityWatch")
                                : t("severityOk")}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-6 border-t pt-3 text-xs text-slate-500">
        {fmt(t("footer"), {
          item: ITEM_METRIC_DEFINITIONS_VERSION,
          dash: TEACHER_ANALYTICS_DEFINITIONS_VERSION,
          at: new Date(lastUpdated).toLocaleString(loc, { dateStyle: "short", timeStyle: "short" }),
        })}
      </p>
    </main>
  );
}
