import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgAdminContext } from "@/lib/org-admin";
import { summarizeCohort, type StudentRow } from "@/lib/analytics";
import { detectRisk } from "@/lib/progress";
import { MeterBar, SectionHeader, StatCard } from "@/components/dashboard";
import { fmt, getLang, mkT, type Lang } from "@/lib/i18n";
import { DASH } from "@/lib/ui-text/dash";
import { AlertControls } from "./alert-controls";
import { BankIdlePanel } from "@/components/bank-idle-panel";

export const dynamic = "force-dynamic";

interface Alert {
  id: string;
  student_id: string;
  code: string;
  message: string;
  status: string;
  studentName: string;
}

// ── Panel bank soal: terpakai vs menganggur + flag soal demo Matematika/Kimia ──
const DEMO_BANK_SLUGS = ["matematika-numerik-demo", "kimia-dasar-demo"];

interface BankRow {
  id: string;
  type: string;
  prompt: string;
  difficulty: string;
  key: string;
  used: boolean;
  courseSlug: string | null;
}

interface BankPanelData {
  total: number;
  used: number;
  idle: number;
  demoTotal: number;
  demoIdle: number;
  rows: BankRow[];
}

interface DemoCourseRow {
  id: string;
  slug: string;
  course_versions: {
    levels: {
      modules: {
        lessons: {
          activities: {
            assessments: { assessment_questions: { question_version_id: string }[] }[];
          }[];
        }[];
      }[];
    }[];
  }[] | null;
}

/** Ringkas kunci jawaban dari grading_json versi terbaru (per tipe soal). */
function summarizeKey(type: string, grading: Record<string, unknown> | undefined): string {
  if (!grading) return "";
  switch (type) {
    case "single_choice":
    case "true_false":
      return String(grading.correctOptionId ?? "");
    case "multiple_choice":
      return Array.isArray(grading.correctOptionIds)
        ? (grading.correctOptionIds as string[]).join(", ")
        : "";
    case "numeric_tolerance": {
      const exp = grading.expected;
      const unit = (grading.unit as { expectedUnit?: string } | undefined)?.expectedUnit;
      return exp === undefined ? "" : `${exp}${unit ? " " + unit : ""}`;
    }
    case "short_text":
      return Array.isArray(grading.acceptedAnswers)
        ? (grading.acceptedAnswers as string[]).join(" / ")
        : "";
    default:
      return ""; // essay/file → kunci manual (moderation)
  }
}

/** Stats bank + daftar soal demo (Matematika/Kimia) dengan kunci & kesulitan. */
async function getQuestionBankPanel(orgId: string): Promise<BankPanelData | null> {
  const supabase = await createClient();
  const { data: qs } = await supabase
    .from("questions")
    .select("id,type,prompt_json,difficulty")
    .eq("organization_id", orgId);
  const qRows = (qs as
    | { id: string; type: string; prompt_json: { text?: string }; difficulty: string }[]
    | null) ?? [];
  if (qRows.length === 0) return null;

  const qids = qRows.map((q) => q.id);
  const { data: vs } = await supabase
    .from("question_versions")
    .select("id,question_id,version,grading_json")
    .in("question_id", qids);
  const vRows = (vs as
    | { id: string; question_id: string; version: number; grading_json: Record<string, unknown> }[]
    | null) ?? [];
  const latestByQ = new Map<string, (typeof vRows)[number]>();
  for (const v of vRows) if (!latestByQ.has(v.question_id)) latestByQ.set(v.question_id, v); // order desc → terbaru menang

  const usedIds = new Set<string>();
  if (vRows.length > 0) {
    const { data: aq } = await supabase
      .from("assessment_questions")
      .select("question_version_id")
      .in("question_version_id", vRows.map((v) => v.id));
    for (const r of (aq as { question_version_id: string }[] | null) ?? []) usedIds.add(r.question_version_id);
  }

  // Rantai kursus demo → version id (slug kursus asal soal).
  const { data: demoCourses } = await supabase
    .from("courses")
    .select("id,slug,course_versions(levels(modules(lessons(activities(assessments(assessment_questions(question_version_id)))))))")
    .in("slug", DEMO_BANK_SLUGS);
  const demoCourseByVersion = new Map<string, string>();
  for (const c of (demoCourses as DemoCourseRow[] | null) ?? []) {
    for (const cv of c.course_versions ?? [])
      for (const l of cv.levels ?? [])
        for (const m of l.modules ?? [])
          for (const le of m.lessons ?? [])
            for (const a of le.activities ?? [])
              for (const as of a.assessments ?? [])
                for (const aq2 of as.assessment_questions ?? [])
                  demoCourseByVersion.set(aq2.question_version_id, c.slug);
  }

  const total = qRows.length;
  let used = 0;
  const rows: BankRow[] = [];
  for (const q of qRows) {
    const latest = latestByQ.get(q.id);
    const isUsed = latest ? usedIds.has(latest.id) : false;
    if (isUsed) used++;
    const demoSlug = latest ? demoCourseByVersion.get(latest.id) ?? null : null;
    if (demoSlug) {
      rows.push({
        id: q.id,
        type: q.type,
        prompt: q.prompt_json?.text ?? "",
        difficulty: q.difficulty,
        key: summarizeKey(q.type, latest?.grading_json),
        used: isUsed,
        courseSlug: demoSlug,
      });
    }
  }
  rows.sort((a, b) => Number(a.used) - Number(b.used) || a.prompt.localeCompare(b.prompt));
  return { total, used, idle: total - used, demoTotal: rows.length, demoIdle: rows.filter((r) => !r.used).length, rows };
}

async function teacherOrgId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: mem } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "teacher")
    .eq("status", "active")
    .limit(1)
    .single();
  return (mem as { organization_id: string } | null)?.organization_id ?? null;
}

async function getDashboard(userId: string, cohortId: string | null, lang: Lang = "id") {
  const supabase = await createClient();
  const { data: cohorts } = await supabase.from("cohorts").select("id,name").eq("teacher_id", userId);
  const list = (cohorts as { id: string; name: string }[] | null) ?? [];
  const active = list.find((c) => c.id === cohortId) ?? list[0];
  if (!active)
    return {
      cohorts: list,
      active: null as null | { id: string; name: string },
      rows: [] as StudentRow[],
      alerts: [] as Alert[],
      pending: 0,
      recent: [] as { id: string; label: string }[],
    };

  const { data: members } = await supabase
    .from("cohort_members")
    .select("student_id")
    .eq("cohort_id", active.id);
  const studentIds = ((members as { student_id: string }[] | null) ?? []).map((m) => m.student_id);
  const rows: StudentRow[] = [];
  for (const sid of studentIds) {
    const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", sid).single();
    const { data: enr } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", sid)
      .eq("cohort_id", active.id)
      .eq("status", "active")
      .limit(1)
      .single();
    const enrollmentId = (enr as { id: string } | null)?.id;
    let progressPct = 0;
    let mastery = 0;
    let lastActivity: string | null = null;
    if (enrollmentId) {
      const { data: snaps } = await supabase
        .from("progress_snapshots")
        .select("percent,mastery,last_activity_at")
        .eq("enrollment_id", enrollmentId)
        .eq("entity_type", "lesson");
      const ss =
        (snaps as { percent: number; mastery: number; last_activity_at: string | null }[] | null) ?? [];
      if (ss.length > 0) {
        progressPct = ss.reduce((a, s) => a + Number(s.percent), 0) / ss.length;
        mastery = ss.reduce((a, s) => a + Number(s.mastery), 0) / ss.length;
        lastActivity =
          ss
            .map((s) => s.last_activity_at)
            .filter(Boolean)
            .sort()
            .pop() ?? null;
      }
    }
    const { count } = await supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", enrollmentId ?? "00000000-0000-0000-0000-000000000000")
      .neq("status", "in_progress");
    rows.push({
      studentId: sid,
      displayName: (prof as { display_name: string } | null)?.display_name ?? sid.slice(0, 8),
      progressPct: Math.round(progressPct),
      mastery: Math.round(mastery * 100) / 100,
      lastActivityAt: lastActivity,
      submittedCount: count ?? 0,
    });
  }

  const { data: alertRows } = await supabase
    .from("alerts")
    .select("id,student_id,code,message,status")
    .eq("cohort_id", active.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);
  const alerts: Alert[] = [];
  for (const a of (alertRows as
    { id: string; student_id: string; code: string; message: string; status: string }[] | null) ?? []) {
    const row = rows.find((r) => r.studentId === a.student_id);
    alerts.push({ ...a, studentName: row?.displayName ?? a.student_id.slice(0, 8) });
  }

  // Auto-sinyal dihitung live (explainable); guru menindaklanjuti via AlertControls (persist alerts).
  const autoSignals: Alert[] = [];
  for (const r of rows) {
    const inactiveDays = r.lastActivityAt
      ? Math.round((Date.now() - Date.parse(r.lastActivityAt)) / 86400000)
      : 999;
    for (const s of detectRisk(
      {
        inactiveDays,
        attemptsLast7d: 0,
        scoreDelta: 0,
        avgSecondsPerItem: 60,
        accuracy: 1,
        prereqMastery: 1,
        progressPct: r.progressPct,
        expectedPct: 70,
      },
      lang,
    )) {
      autoSignals.push({
        id: `auto-${r.studentId}-${s.code}`,
        student_id: r.studentId,
        code: s.code,
        message: s.message,
        status: "open",
        studentName: r.displayName,
      });
    }
  }

  return {
    cohorts: list,
    active,
    rows,
    alerts: [...alerts, ...autoSignals],
    pending: 0,
    recent: [] as { id: string; label: string }[],
  };
}

export default async function TeacherPage({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  const { cohort } = await searchParams;
  const lang = await getLang();
  const t = mkT(DASH, lang);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub ?? "";
  let data: Awaited<ReturnType<typeof getDashboard>>;
  try {
    data = await getDashboard(userId, cohort ?? null, lang);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <p role="alert">{t("loadError")}</p>
      </main>
    );
  }
  // Org-admin (facet Owner, ADR-008): guru aktif org yang memiliki ≥1 course —
  // hanya mereka yang melihat tautan admin mapping.
  const adminCtx = await getOrgAdminContext();

  if (!data.active) {
    return (
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">{t("emptyTitle")}</h1>
        <p className="mt-4 rounded-xl border p-5" role="status">
          {t("emptyNoCohort")}
        </p>
      </main>
    );
  }
  const orgId = userId ? await teacherOrgId(userId) : null;
  let bank: BankPanelData | null = null;
  if (orgId) {
    try {
      bank = await getQuestionBankPanel(orgId);
    } catch {
      bank = null; // panel opsional — jangan mematahkan dashboard
    }
  }
  const summary = summarizeCohort(data.rows);

  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
            {data.active.name}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {data.cohorts.map((c) => (
          <Link
            key={c.id}
            href={`/teacher?cohort=${c.id}`}
            aria-current={c.id === data.active?.id ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 font-medium ${
              c.id === data.active?.id
                ? "border-blue-700 bg-blue-700 text-white"
                : "bg-white hover:bg-slate-50 dark:bg-slate-900"
            }`}
          >
            {c.name}
          </Link>
        ))}
        <a
          href={`/api/teacher/export?cohortId=${data.active.id}`}
          className="rounded-full border border-dashed px-4 py-1.5 font-medium underline"
        >
          {t("exportCsv")}
        </a>
      </div>

      {/* Quick actions — prominent cards for the most common next steps. */}
      <SectionHeader title={t("quickActionsTitle")} hint={t("quickActionsHint")} />
      <nav aria-label={t("quickActionsTitle")} className="mt-3 grid gap-3 sm:grid-cols-3">
        <Link
          href="/teacher/grading"
          className="group rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm transition hover:border-amber-400 hover:shadow-md dark:from-amber-950/30 dark:to-slate-900 dark:hover:border-amber-600"
        >
          <p className="text-2xl">📝</p>
          <p className="mt-2 font-bold text-amber-800 group-hover:underline dark:text-amber-200">
            {t("quickGrading")}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {fmt(t("quickGradingDesc"), { n: String(summary.needsAttention) })}
          </p>
        </Link>
        <Link
          href="/teacher/courses/new"
          className="group rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:from-blue-950/30 dark:to-slate-900 dark:hover:border-blue-600"
        >
          <p className="text-2xl">📚</p>
          <p className="mt-2 font-bold text-blue-800 group-hover:underline dark:text-blue-200">
            {t("quickNewCourse")}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("quickNewCourseDesc")}</p>
        </Link>
        <Link
          href="/teacher/cohorts"
          className="group rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md dark:from-emerald-950/30 dark:to-slate-900 dark:hover:border-emerald-600"
        >
          <p className="text-2xl">👥</p>
          <p className="mt-2 font-bold text-emerald-800 group-hover:underline dark:text-emerald-200">
            {t("quickImport")}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("quickImportDesc")}</p>
        </Link>
      </nav>

      <section aria-label={t("summaryAria")} className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label={t("enrolled")}
          value={String(summary.enrolled)}
          tone="blue"
          hint={t("enrolledHint")}
        />
        <StatCard
          label={t("active7d")}
          value={String(summary.active7d)}
          tone="emerald"
          hint={t("active7dHint")}
        />
        <StatCard
          label={t("avgProgress")}
          value={`${Math.round(summary.avgProgress)}%`}
          tone="blue"
          hint={t("avgProgressHint")}
        />
        <StatCard
          label={t("avgMastery")}
          value={`${Math.round(summary.avgMastery * 100)}%`}
          tone="emerald"
          hint={t("avgMasteryHint")}
        />
        <StatCard
          label={t("needsAttention")}
          value={String(summary.needsAttention)}
          tone={summary.needsAttention > 0 ? "amber" : "slate"}
          hint={t("needsAttentionHint")}
        />
      </section>
      <p className="mt-2 text-xs text-slate-500">{fmt(t("metricsFootnote"), { n: summary.enrolled })}</p>

      {bank && (
        <>
          <SectionHeader title={t("bankTitle")} hint={t("bankHint")} />
          <section aria-label={t("bankAria")} className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label={t("bankTotal")} value={String(bank.total)} tone="blue" hint={t("bankTotalHint")} />
            <StatCard label={t("bankUsed")} value={String(bank.used)} tone="emerald" hint={t("bankUsedHint")} />
            <StatCard label={t("bankIdle")} value={String(bank.idle)} tone="amber" hint={t("bankIdleHint")} />
            <StatCard
              label={t("bankUtil")}
              value={`${bank.total > 0 ? Math.round((bank.used / bank.total) * 100) : 0}%`}
              tone="slate"
              hint={t("bankUtilHint")}
            />
          </section>
          <p className="mt-2 text-xs text-slate-500">
            {fmt(t("bankDemoIdleLine"), { n: bank.demoIdle, m: bank.demoTotal })}
          </p>
          {bank.rows.length === 0 ? (
            <p role="status" className="mt-3 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900">
              {t("bankNoDemo")}
            </p>
          ) : (
            <BankIdlePanel rows={bank.rows} lang={lang} />
          )}
          <p className="mt-2 text-xs text-slate-500">{t("bankFootnote")}</p>
        </>
      )}

      <SectionHeader title={t("matrixTitle")} hint={t("matrixHint")} />
      {data.rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900" role="status">
          {t("matrixEmpty")}
        </p>
      ) : (
        <>
          {/* Kartu tumpuk untuk layar kecil: tabel 6 kolom tidak muat @360px
              tanpa scroll horizontal (gate responsif). Data & status sama. */}
          <ul className="mt-4 space-y-3 md:hidden">
            {data.rows.map((r) => (
              <li
                key={r.studentId}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2 border-b p-4">
                  <p className="font-bold">
                    <Link
                      href={`/teacher/students/${r.studentId}?cohort=${data.active?.id}`}
                      className="text-blue-700 underline dark:text-blue-300"
                    >
                      {r.displayName}
                    </Link>
                  </p>
                  <span
                    aria-label={fmt(t("statusAria"), { name: r.displayName })}
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      r.progressPct < 50
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {r.progressPct < 50 ? t("statusWatch") : t("statusOnTrack")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 p-4 text-center">
                  <div>
                    <p className="text-xl font-extrabold">{r.progressPct}%</p>
                    <p className="text-xs text-slate-500">{t("progress")}</p>
                    <div className="mt-1">
                      <MeterBar pct={r.progressPct} label={fmt(t("progressAria"), { name: r.displayName })} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold">{Math.round(r.mastery * 100)}%</p>
                    <p className="text-xs text-slate-500">{t("mastery")}</p>
                    <div className="mt-1">
                      <MeterBar
                        pct={r.mastery * 100}
                        label={fmt(t("masteryAria"), { name: r.displayName })}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold">{r.submittedCount}</p>
                    <p className="text-xs text-slate-500">{t("submit")}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border bg-white shadow-sm md:block dark:bg-slate-900">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-2">{t("colStudent")}</th>
                  <th className="p-2">{t("progress")}</th>
                  <th className="p-2">{t("mastery")}</th>
                  <th className="p-2">{t("submit")}</th>
                  <th className="p-2">{t("colStatus")}</th>
                  <th className="p-2">{t("colDetail")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.studentId} className="border-b">
                    <td className="p-2 font-semibold">{r.displayName}</td>
                    <td className="p-2">{r.progressPct}%</td>
                    <td className="p-2">{Math.round(r.mastery * 100)}%</td>
                    <td className="p-2">{r.submittedCount}</td>
                    <td className="p-2">{r.progressPct < 50 ? t("statusWatch") : t("statusOnTrack")}</td>
                    <td className="p-2">
                      <Link
                        href={`/teacher/students/${r.studentId}?cohort=${data.active?.id}`}
                        className="text-blue-700 underline"
                      >
                        {t("detail")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionHeader title={t("riskTitle")} hint={t("riskHint")} />
      <div className="mt-4">
        <AlertControls cohortId={data.active.id} alerts={data.alerts} lang={lang} />
      </div>

      <SectionHeader title={t("toolsTitle")} hint={t("toolsHint")} />
      <nav aria-label={t("toolsAria")} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/teacher/grading", title: t("toolGrading"), desc: t("toolGradingDesc") },
          { href: "/teacher/questions", title: t("toolQuestions"), desc: t("toolQuestionsDesc") },
          { href: "/teacher/cohorts", title: t("toolCohorts"), desc: t("toolCohortsDesc") },
          { href: "/teacher/analytics", title: t("toolAnalytics"), desc: t("toolAnalyticsDesc") },
          { href: "/teacher/certificates", title: t("toolCertificates"), desc: t("toolCertificatesDesc") },
          // Tautan admin hanya bila adminCtx (guru pemilik course) — bukan semua guru.
          ...((adminCtx && [
            { href: "/teacher/admin/map", title: t("toolAdminMap"), desc: t("toolAdminMapDesc") },
          ]) ||
            []),
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:bg-slate-900"
          >
            <p className="font-bold text-blue-700 group-hover:underline dark:text-blue-300">{a.title}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.desc}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
