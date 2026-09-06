import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeUnlock, nextBestAction } from "@/lib/progress";
import { DEFAULT_WEEKLY_GOAL, isSameIsoWeek, isoWeekStart, weeklyRollup } from "@/lib/progress-planning";

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

/** Dashboard murid live: enrollment aktif pertama + snapshot + prereq → rekomendasi. */
async function getDashboard(userId: string): Promise<{
  levels: LiveLevel[];
  courseTitle: string;
  enrollmentId: string;
  weekly: ReturnType<typeof weeklyRollup>;
} | null> {
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id,course_id,courses(title)")
    .eq("student_id", userId)
    .eq("status", "active")
    .limit(1);
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
      weekly: weeklyRollup({ completedThisWeek: 0, goalValue: DEFAULT_WEEKLY_GOAL }),
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

  // Target mingguan (KURANG Phase 3): goal dari weekly_plans (default bila
  // belum ada), progress = aktivitas selesai pada minggu ISO berjalan (tz org).
  const weekStart = isoWeekStart(new Date());
  const { data: planRows } = await supabase
    .from("weekly_plans")
    .select("goal_value")
    .eq("enrollment_id", enr.id)
    .eq("week_start", weekStart)
    .limit(1);
  const goalValue =
    ((planRows as { goal_value: number }[] | null) ?? [])[0]?.goal_value ?? DEFAULT_WEEKLY_GOAL;
  const { data: weekEvents } = await supabase
    .from("learning_events")
    .select("created_at")
    .eq("enrollment_id", enr.id)
    .eq("event_type", "activity_completed");
  const completedThisWeek = ((weekEvents as { created_at: string }[] | null) ?? []).filter((e) =>
    isSameIsoWeek(new Date(e.created_at), weekStart),
  ).length;
  const weekly = weeklyRollup({ completedThisWeek, goalValue });

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
  return { levels, courseTitle: enr.courses.title, enrollmentId: enr.id, weekly };
}

export default async function LearnPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  let live: Awaited<ReturnType<typeof getDashboard>> = null;
  if (userId) {
    try {
      live = await getDashboard(userId);
    } catch {
      live = null;
    }
  }

  const levels = live?.levels ?? [];
  const rec = nextBestAction(levels.map((l) => ({ ...l, locked: l.state === "locked" })));

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold text-blue-700">Halo, Pelajar 👋</p>
      <h1 className="mt-1 text-3xl font-bold">Target hari ini{live ? ` — ${live.courseTitle}` : ""}</h1>
      {!live ? (
        <p className="mt-4 rounded-xl border p-5" role="status">
          Belum ada enrollment aktif. Hubungi guru Anda untuk didaftarkan ke kelas.
        </p>
      ) : rec ? (
        <section aria-label="Rekomendasi" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold">Lanjutkan belajar</h2>
          <p className="mt-1">{rec.reason}</p>
          <Link
            href={`/learn/${rec.id}?enrollment=${live.enrollmentId}`}
            className="mt-3 inline-block rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
          >
            Lanjutkan belajar
          </Link>
        </section>
      ) : (
        <p className="mt-4 rounded-xl border p-5">Belum ada rekomendasi — semua terkunci atau selesai. 🎉</p>
      )}

      {live && (
        <>
          <section
            aria-label="Target mingguan"
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">Target mingguan</h2>
              <p className="text-sm text-slate-600">
                {live.weekly.completed}/{live.weekly.goal} selesai
              </p>
            </div>
            <div
              role="progressbar"
              aria-valuenow={live.weekly.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress target mingguan"
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-100"
            >
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${live.weekly.pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {live.weekly.achieved
                ? "Target minggu ini tercapai 🎉"
                : `${live.weekly.goal - live.weekly.completed} aktivitas lagi untuk mencapai target minggu ini.`}
            </p>
          </section>

          <h2 className="mt-8 text-xl font-semibold">Peta level</h2>
          <ol className="mt-3 space-y-3">
            {levels.map((l) => {
              const label =
                l.state === "locked"
                  ? "Terkunci — selesaikan prerequisite"
                  : l.state === "completed"
                    ? `Mastery ${Math.round(l.mastery * 100)}% — selesai`
                    : l.state === "in_progress"
                      ? `Mastery ${Math.round(l.mastery * 100)}% — sedang dikerjakan`
                      : "Tersedia";
              const pill =
                l.state === "locked"
                  ? "Locked"
                  : l.state === "completed"
                    ? "Completed"
                    : l.state === "in_progress"
                      ? "In progress"
                      : "Available";
              const pillClass =
                l.state === "locked"
                  ? "bg-slate-100 text-slate-600"
                  : l.state === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : l.state === "in_progress"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700";
              return (
                <li key={l.id} className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <p className="font-semibold">{l.title}</p>
                    <p className="text-sm text-slate-600">{label}</p>
                  </div>
                  <span
                    aria-label={`Status ${l.title}`}
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${pillClass}`}
                  >
                    {pill}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
      <p className="mt-6 text-sm text-slate-500">
        <Link href="/catalog" className="underline">
          Lihat katalog coursemu
        </Link>
      </p>
    </main>
  );
}
