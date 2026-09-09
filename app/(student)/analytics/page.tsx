import { createClient } from "@/lib/supabase/server";
import { getLang, mkT, fmt } from "@/lib/i18n";
import { STUDENT_ANALYTICS } from "@/lib/ui-text/student-analytics";
import { ChartPanel, ColumnChart } from "@/components/charts";

export const dynamic = "force-dynamic";

interface QuizScore {
  label: string;
  value: number;
  hint?: string;
}

interface ActivityLog {
  date: string;
  minutesActive: number;
  activitiesCompleted: number;
}

async function getStudentAnalytics(userId: string) {
  const supabase = await createClient();

  // Fetch enrollments
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id,course_id,courses(title)")
    .eq("student_id", userId);
  const enrs = (enrollments as { id: string; course_id: string; courses: { title: string } | null }[] | null) ?? [];
  if (enrs.length === 0) return null;

  // Fetch attempts for quiz scores
  const enrollmentIds = enrs.map((e) => e.id);
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id,assessment_id,status,final_score,submitted_at")
    .in("enrollment_id", enrollmentIds)
    .eq("status", "finalized")
    .order("submitted_at", { ascending: false })
    .limit(20);

  const quizScores: QuizScore[] = ((attempts as
    | { id: string; assessment_id: string; final_score: number | null; submitted_at: string | null }[]
    | null) ?? []
  )
    .filter((a) => a.final_score !== null)
    .slice(0, 10)
    .reverse()
    .map((a, i) => ({
      label: `#${i + 1}`,
      value: a.final_score ?? 0,
      hint: a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : undefined,
    }));

  // Fetch study sessions for activity log
  const { data: sessions } = await supabase
    .from("study_sessions")
    .select("started_at,active_seconds")
    .in("enrollment_id", enrollmentIds)
    .order("started_at", { ascending: false })
    .limit(100);

  // Aggregate by date (last 14 days)
  const now = Date.now();
  const dayMs = 86400000;
  const activityLog: ActivityLog[] = [];
  for (let d = 13; d >= 0; d--) {
    const dayStart = new Date(now - d * dayMs);
    const dayStr = dayStart.toISOString().slice(0, 10);
    const daySessions = ((sessions as { started_at: string; active_seconds: number }[] | null) ?? []).filter(
      (s) => s.started_at?.slice(0, 10) === dayStr,
    );
    activityLog.push({
      date: dayStr,
      minutesActive: Math.round(daySessions.reduce((sum, s) => sum + (s.active_seconds ?? 0), 0) / 60),
      activitiesCompleted: daySessions.length,
    });
  }

  // Compute summary stats
  const totalMinutes = activityLog.reduce((sum, d) => sum + d.minutesActive, 0);
  const avgScore =
    quizScores.length > 0
      ? Math.round(quizScores.reduce((sum, s) => sum + s.value, 0) / quizScores.length)
      : 0;
  const totalAttempts = (attempts as { id: string }[] | null)?.length ?? 0;
  const coursesEnrolled = enrs.length;

  return {
    quizScores,
    activityLog,
    totalMinutes,
    avgScore,
    totalAttempts,
    coursesEnrolled,
  };
}

export default async function StudentAnalyticsPage() {
  const lang = await getLang();
  const t = mkT(STUDENT_ANALYTICS, lang);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub ?? "";

  const data = await getStudentAnalytics(userId);

  if (!data) {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-4 text-slate-500">{t("noData")}</p>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-sm text-slate-500">{t("subtitle")}</p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500">{t("totalMinutes")}</p>
          <p className="mt-1 text-2xl font-bold">{data.totalMinutes}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500">{t("avgScore")}</p>
          <p className="mt-1 text-2xl font-bold">{data.avgScore}%</p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500">{t("totalAttempts")}</p>
          <p className="mt-1 text-2xl font-bold">{data.totalAttempts}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500">{t("coursesEnrolled")}</p>
          <p className="mt-1 text-2xl font-bold">{data.coursesEnrolled}</p>
        </div>
      </div>

      {/* Activity chart */}
      <ChartPanel title={t("activityChartTitle")}>
        {data.activityLog.some((d) => d.minutesActive > 0) ? (
          <ColumnChart
            bars={data.activityLog.map((d) => ({
              label: d.date.slice(5),
              value: d.minutesActive,
            }))}
            ariaLabel={t("activityChartTitle")}
          />
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">{t("activityChartEmpty")}</p>
        )}
      </ChartPanel>

      {/* Quiz scores chart */}
      <div className="mt-6">
        <ChartPanel title={t("quizChartTitle")}>
          {data.quizScores.length > 0 ? (
            <ColumnChart
              bars={data.quizScores}
              ariaLabel={t("quizChartTitle")}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">{t("quizChartEmpty")}</p>
          )}
        </ChartPanel>
      </div>

      {/* Detailed breakdown */}
      <h2 className="mt-8 text-xl font-semibold">{t("recentActivity")}</h2>
      <div className="mt-3 space-y-1">
        {data.activityLog
          .filter((d) => d.minutesActive > 0)
          .slice(-7)
          .map((d) => (
            <div key={d.date} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <span>{new Date(d.date).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
              <span className="text-slate-500">
                {fmt(t("activityLine"), { minutes: String(d.minutesActive), activities: String(d.activitiesCompleted) })}
              </span>
            </div>
          ))}
      </div>
    </main>
  );
}
