import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeUnlock, nextBestAction } from "@/lib/progress";
import { DISPLAY_TIMEZONE } from "@/lib/time";
import {
  DEFAULT_WEEKLY_GOAL_MINUTES,
  formatActiveMinutes,
  isSameIsoWeek,
  isoWeekStart,
  weekActiveMinutesByDay,
  weeklyActiveMinutes,
  weeklyRollupForUnit,
  type ActiveDayBar,
  type WeeklyGoalUnit,
} from "@/lib/progress-planning";
import { MeterBar, ProgressRing, SectionHeader, StatCard, StateBadge } from "@/components/dashboard";
import { ChartPanel, ColumnChart } from "@/components/charts";
import { fmt, getLang, localeFor, mkT } from "@/lib/i18n";
import { LEARN } from "@/lib/ui-text/learn";
import { WeeklyGoalForm } from "./weekly-goal-form";

export const dynamic = "force-dynamic";

type LevelState = "locked" | "available" | "in_progress" | "completed";

interface LiveLevel {
  id: string;
  title: string;
  mastery: number;
  state: LevelState;
  deadlineInDays: number | null;
  lastActivityDaysAgo: number | null;
}

interface WeeklyInfo {
  unit: WeeklyGoalUnit;
  goal: number;
  completed: number;
  pct: number;
  achieved: boolean;
  status: "active" | "completed";
}

interface QuizBar {
  label: string;
  value: number;
  hint?: string;
}

/** Dashboard murid live: enrollment aktif (query `?enrollment=` bila ada, fallback
 *  yang pertama) + snapshot + prereq → rekomendasi. */
async function getDashboard(
  userId: string,
  requestedEnrollmentId?: string,
  quizTitle = "Kuis",
  attemptHint: (n: number) => string = (n) => `Percobaan ${n}`,
  lang: "id" | "en" = "id",
): Promise<{
  levels: LiveLevel[];
  courseTitle: string;
  enrollmentId: string;
  weekly: WeeklyInfo;
  weekBars: ActiveDayBar[];
  quizBars: QuizBar[];
} | null> {
  const supabase = await createClient();
  let query = supabase
    .from("enrollments")
    .select("id,course_id,courses(title)")
    .eq("student_id", userId)
    .eq("status", "active");
  // Catalog & nav mengarahkan ke enrollment spesifik (?enrollment=...). Tanpa
  // filter, murid dengan >1 enrollment selalu mendarat di yang pertama — defect
  // live: klik kursus Python tetap menampilkan Matematika. Patuhi permintaan.
  if (requestedEnrollmentId) query = query.eq("id", requestedEnrollmentId);
  query = query.limit(1);
  const { data: enrollments } = await query;
  const enr = ((enrollments as
    { id: string; course_id: string; courses: { title: string } | null }[] | null) ?? [])[0];
  if (!enr?.courses) return null;

  const { data: versions } = await supabase
    .from("course_versions")
    .select("id")
    .eq("course_id", enr.course_id)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1);
  const v = ((versions as { id: string }[] | null) ?? [])[0];
  if (!v) {
    return {
      levels: [],
      courseTitle: enr.courses.title,
      enrollmentId: enr.id,
      weekly: { unit: "minutes", ...weeklyRollupForUnit("minutes", 0, DEFAULT_WEEKLY_GOAL_MINUTES) },
      weekBars: [],
      quizBars: [],
    };
  }

  const { data: levelRows } = await supabase
    .from("levels")
    .select("id,title")
    .eq("course_version_id", v.id)
    .order("position");
  const rows = (levelRows as { id: string; title: string }[] | null) ?? [];
  const { data: snaps } = await supabase
    .from("progress_snapshots")
    .select("entity_id,status,mastery,last_activity_at")
    .eq("enrollment_id", enr.id)
    .eq("entity_type", "level");
  const snapById = new Map(
    (
      (snaps as
        { entity_id: string; status: string; mastery: number; last_activity_at: string | null }[] | null) ??
      []
    ).map((s) => [s.entity_id, s]),
  );

  // Target mingguan unit-aware (flip ADR-010): goal dari weekly_plans; bila
  // belum ada baris → default 'minutes' (target menit kini jujur: write path
  // study_sessions sudah ada). Progress dihitung per unit baris target:
  // completions = event activity_completed; minutes = study_sessions minggu ini.
  const weekStart = isoWeekStart(new Date());
  const { data: planRows } = await supabase
    .from("weekly_plans")
    .select("goal_unit,goal_value")
    .eq("enrollment_id", enr.id)
    .eq("week_start", weekStart)
    .limit(1);
  const plan = ((planRows as { goal_unit: WeeklyGoalUnit; goal_value: number }[] | null) ?? [])[0];
  const unit: WeeklyGoalUnit = plan?.goal_unit ?? "minutes";
  const goalValue = plan?.goal_value ?? DEFAULT_WEEKLY_GOAL_MINUTES;
  let measured = 0;
  let sessionRows: { started_at: string; active_seconds: number }[] | null = null;
  if (unit === "minutes") {
    const { data: sessionRowsData } = await supabase
      .from("study_sessions")
      .select("started_at,active_seconds")
      .eq("enrollment_id", enr.id);
    sessionRows = (sessionRowsData as { started_at: string; active_seconds: number }[] | null) ?? [];
    measured = weeklyActiveMinutes(sessionRows, weekStart);
  } else {
    const { data: weekEvents } = await supabase
      .from("learning_events")
      .select("created_at")
      .eq("enrollment_id", enr.id)
      .eq("event_type", "activity_completed");
    measured = ((weekEvents as { created_at: string }[] | null) ?? []).filter((e) =>
      isSameIsoWeek(new Date(e.created_at), weekStart),
    ).length;
  }
  const weekly: WeeklyInfo = { unit, ...weeklyRollupForUnit(unit, measured, goalValue) };

  // Grafik menit aktif per hari (Sen–Min) — sumber sama dengan ring target di atas.
  const weekBars = weekActiveMinutesByDay(sessionRows ?? [], weekStart, DISPLAY_TIMEZONE, lang);

  // Grafik skor kuis: percobaan TERAKHIR yang sudah dinilai (final_score server).
  const { data: attemptRowsData } = await supabase
    .from("attempts")
    .select("assessment_id,attempt_no,final_score,submitted_at")
    .eq("enrollment_id", enr.id)
    .not("final_score", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(6);
  const gradedAttempts = (
    (attemptRowsData as
      { assessment_id: string; attempt_no: number; final_score: number; submitted_at: string }[] | null) ?? []
  ).reverse();
  const quizTitles = new Map<string, string>();
  if (gradedAttempts.length > 0) {
    const asmtIds = [...new Set(gradedAttempts.map((a) => a.assessment_id))];
    const { data: asmtRowsData } = await supabase
      .from("assessments")
      .select("id,activities(title)")
      .in("id", asmtIds);
    for (const a of (asmtRowsData as { id: string; activities: { title: string } | null }[] | null) ?? []) {
      quizTitles.set(a.id, a.activities?.title ?? quizTitle);
    }
  }
  const quizBars = gradedAttempts.map((a) => ({
    label: quizTitles.get(a.assessment_id) ?? quizTitle,
    value: Number(a.final_score ?? 0),
    hint: attemptHint(a.attempt_no),
  }));

  const { data: prereqs } = await supabase.from("prerequisites").select("target_id,required_id");
  const edges = new Map<string, string[]>();
  for (const p of (prereqs as { target_id: string; required_id: string }[] | null) ?? []) {
    const arr = edges.get(p.target_id) ?? [];
    arr.push(p.required_id);
    edges.set(p.target_id, arr);
  }
  const completed = new Set(rows.filter((l) => snapById.get(l.id)?.status === "completed").map((l) => l.id));
  const unlock = computeUnlock(
    rows.map((l) => l.id),
    completed,
    [...edges.entries()].map(([targetId, requiredIds]) => ({ targetId, requiredIds })),
  );
  const now = Date.now();
  const levels: LiveLevel[] = rows.map((l) => {
    const s = snapById.get(l.id);
    const last = s?.last_activity_at
      ? Math.max(0, Math.round((now - Date.parse(s.last_activity_at)) / 86400000))
      : null;
    const unlockState = unlock.get(l.id) ?? "locked";
    let state: LevelState = "available";
    if (unlockState === "locked") state = "locked";
    else if (s?.status === "completed" || (s?.mastery ?? 0) >= 1) state = "completed";
    else if (s?.status === "in_progress" || (s?.mastery ?? 0) > 0) state = "in_progress";
    return {
      id: l.id,
      title: l.title,
      mastery: s?.mastery ?? 0,
      state,
      deadlineInDays: null,
      lastActivityDaysAgo: last,
    };
  });
  return { levels, courseTitle: enr.courses.title, enrollmentId: enr.id, weekly, weekBars, quizBars };
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ enrollment?: string }>;
}) {
  const { enrollment } = await searchParams;
  const lang = await getLang();
  const t = mkT(LEARN, lang);
  const loc = localeFor(lang);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  let live: Awaited<ReturnType<typeof getDashboard>> = null;
  if (userId) {
    try {
      live = await getDashboard(
        userId,
        enrollment,
        t("quizFallbackTitle"),
        (n) => fmt(t("quizAttemptHint"), { n }),
        lang,
      );
    } catch {
      live = null;
    }
  }

  const levels = live?.levels ?? [];
  const rec = nextBestAction(
    levels.map((l) => ({ ...l, locked: l.state === "locked" })),
    lang,
  );

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
        {t("eyebrow")}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
        {live ? live.courseTitle : t("fallbackTitle")}
      </h1>
      {!live ? (
        <p
          className="card-lift mt-4 rounded-2xl border bg-white p-5 shadow-[var(--shadow-soft)] dark:bg-slate-900"
          role="status"
        >
          {t("noEnrollment")}
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            <section
              aria-label={t("recAria")}
              className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 p-6 text-white shadow-md md:col-span-3 dark:from-blue-900 dark:to-slate-900"
            >
              <p className="text-sm font-medium text-blue-100">{t("nextStep")}</p>
              {rec ? (
                <>
                  <p className="mt-2 text-lg leading-relaxed font-semibold">{rec.reason}</p>
                  <Link
                    href={`/learn/${rec.id}?enrollment=${live.enrollmentId}`}
                    className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 font-bold text-blue-800 shadow hover:bg-blue-50"
                  >
                    {t("continueLearning")}
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-lg font-semibold">{t("allDone")}</p>
              )}
            </section>

            <section
              aria-label={t("weeklyAria")}
              className="card-lift rounded-2xl border bg-white p-6 text-center shadow-[var(--shadow-soft)] md:col-span-2 dark:bg-slate-900"
            >
              <ProgressRing pct={live.weekly.pct} label={t("weeklyRingAria")} />
              <p className="mt-3 font-semibold">{t("weeklyTarget")}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {live.weekly.unit === "minutes"
                  ? fmt(t("weeklyMinuteSummary"), {
                      done: formatActiveMinutes(live.weekly.completed, lang),
                      goal: formatActiveMinutes(live.weekly.goal, lang),
                    })
                  : fmt(t("weeklyCompletionSummary"), {
                      done: live.weekly.completed,
                      goal: live.weekly.goal,
                    })}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {live.weekly.achieved
                  ? t("weeklyAchieved")
                  : live.weekly.unit === "minutes"
                    ? fmt(t("weeklyRemainingMinutes"), {
                        remaining: formatActiveMinutes(
                          Math.max(0, live.weekly.goal - live.weekly.completed),
                          lang,
                        ),
                      })
                    : fmt(t("weeklyRemainingCompletions"), {
                        remaining: Math.max(0, live.weekly.goal - live.weekly.completed),
                      })}
              </p>
            </section>
          </div>

          <section
            aria-label={t("goalAria")}
            className="card-lift mt-4 rounded-2xl border bg-white p-5 shadow-[var(--shadow-soft)] dark:bg-slate-900"
          >
            <WeeklyGoalForm
              enrollmentId={live.enrollmentId}
              unit={live.weekly.unit}
              goal={live.weekly.goal}
              lang={lang}
            />
          </section>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <ChartPanel
              title={t("activeChartTitle")}
              desc={t("activeChartDesc")}
              updatedAt={new Date().toLocaleString(loc, { timeZone: "Asia/Jakarta" })}
              footnote={t("activeChartFootnote")}
              empty={
                live.weekBars.length === 0 || live.weekBars.every((b) => b.minutes === 0)
                  ? t("activeChartEmpty")
                  : undefined
              }
              lang={lang}
            >
              {live.weekBars.length > 0 && (
                <ColumnChart
                  bars={live.weekBars.map((b) => ({ label: b.label, value: b.minutes }))}
                  ariaLabel={t("activeChartAria")}
                  suffix=" m"
                  tone="blue"
                  lang={lang}
                />
              )}
            </ChartPanel>

            <ChartPanel
              title={t("quizChartTitle")}
              desc={t("quizChartDesc")}
              updatedAt={new Date().toLocaleString(loc, { timeZone: "Asia/Jakarta" })}
              footnote={t("quizChartFootnote")}
              empty={live.quizBars.length === 0 ? t("quizChartEmpty") : undefined}
              lang={lang}
            >
              {live.quizBars.length > 0 && (
                <ColumnChart
                  bars={live.quizBars}
                  ariaLabel={t("quizChartAria")}
                  formatValue={(v) => String(Math.round(v))}
                  suffix="%"
                  tone="emerald"
                  scaleMax={100}
                  lang={lang}
                />
              )}
            </ChartPanel>
          </div>

          <SectionHeader title={t("pathTitle")} hint={fmt(t("pathHint"), { n: levels.length })} />
          <ol className="mt-4 space-y-0">
            {levels.map((l, i) => {
              const label =
                l.state === "locked"
                  ? t("stateLocked")
                  : l.state === "completed"
                    ? fmt(t("stateCompleted"), { pct: Math.round(l.mastery * 100) })
                    : l.state === "in_progress"
                      ? fmt(t("stateInProgress"), { pct: Math.round(l.mastery * 100) })
                      : t("stateAvailable");
              const last = i === levels.length - 1;
              return (
                <li key={l.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && (
                    <span
                      aria-hidden="true"
                      className="absolute top-10 left-[19px] h-[calc(100%-2rem)] w-0.5 bg-slate-200 dark:bg-slate-700"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-bold ${
                      l.state === "completed"
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : l.state === "locked"
                          ? "border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800"
                          : "border-blue-600 bg-white text-blue-700 dark:bg-slate-900"
                    }`}
                  >
                    {l.state === "completed" ? "✓" : l.state === "locked" ? "🔒" : i + 1}
                  </span>
                  <div className="card-lift flex-1 rounded-2xl border bg-white p-4 shadow-[var(--shadow-soft)] dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">{l.title}</p>
                      <StateBadge
                        state={l.state}
                        label={fmt(t("statusAria"), { title: l.title })}
                        lang={lang}
                      />
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{label}</p>
                    <div className="mt-3">
                      <MeterBar pct={l.mastery * 100} label={fmt(t("masteryAria"), { title: l.title })} />
                    </div>
                    {l.state !== "locked" && (
                      <Link
                        href={`/learn/${l.id}?enrollment=${live.enrollmentId}`}
                        className="mt-3 inline-block rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-[var(--glow-btn)] transition hover:from-blue-700 hover:to-indigo-700"
                      >
                        {t("openLevel")}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label={t("statLevelsDone")}
              value={String(levels.filter((l) => l.state === "completed").length)}
              tone="emerald"
            />
            <StatCard
              label={t("statInProgress")}
              value={String(levels.filter((l) => l.state === "in_progress").length)}
              tone="amber"
            />
            <StatCard
              label={t("statLocked")}
              value={String(levels.filter((l) => l.state === "locked").length)}
              tone="slate"
            />
          </div>
        </>
      )}
      <p className="mt-6 text-sm text-slate-500">
        <Link href="/catalog" className="underline">
          {t("catalogLink")}
        </Link>
      </p>
    </main>
  );
}
