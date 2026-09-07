import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeUnlock } from "@/lib/progress";

export const dynamic = "force-dynamic";

interface MapActivity {
  id: string;
  position: number;
  type: string;
  title: string;
  required: boolean;
  completed: boolean;
  locked: boolean;
  assessmentId: string | null;
}

interface MapLesson {
  id: string;
  position: number;
  title: string;
  objective: string;
  required: boolean;
  completed: boolean;
  locked: boolean;
  activities: MapActivity[];
}

interface MapModule {
  id: string;
  position: number;
  title: string;
  lessons: MapLesson[];
}

const QUIZ_LIKE = new Set(["quiz", "assessment"]);

function activityBadge(type: string): string {
  switch (type) {
    case "quiz":
      return "Kuis/Ujian";
    case "article":
      return "Materi";
    case "video_link":
      return "Video";
    case "resource":
      return "Sumber belajar";
    case "reflection":
      return "Refleksi";
    case "assignment_upload":
      return "Tugas";
    case "roblox_challenge":
      return "Tantangan Roblox";
    case "code_board":
      return "Papan kode";
    case "embed_youtube":
      return "Video YouTube";
    case "embed_pdf":
      return "PDF";
    case "embed_audio":
      return "Audio";
    case "embed_file":
      return "Berkas";
    default:
      return type;
  }
}

/** Level map murid: modules → lessons → activities, status completion + unlock server-side. */
async function getLevelMap(levelId: string, enrollmentId: string): Promise<MapModule[] | null> {
  const supabase = await createClient();
  const { data: moduleRows } = await supabase
    .from("modules")
    .select("id,position,title")
    .eq("level_id", levelId)
    .order("position");
  const modules = (moduleRows as { id: string; position: number; title: string }[] | null) ?? [];

  // Aktivitas selesai = event activity_completed (sumber kebenaran sama dengan
  // recomputeProgress; snapshot hanya level/lesson).
  const { data: events } = await supabase
    .from("learning_events")
    .select("entity_id,event_type")
    .eq("enrollment_id", enrollmentId);
  const completed = new Set(
    ((events as { entity_id: string; event_type: string }[] | null) ?? [])
      .filter((e) => e.event_type === "activity_completed")
      .map((e) => e.entity_id),
  );

  const out: MapModule[] = [];
  for (const md of modules) {
    const { data: lessonRows } = await supabase
      .from("lessons")
      .select("id,position,title,objective,required")
      .eq("module_id", md.id)
      .order("position");
    const lessons: MapLesson[] = [];
    for (const le of (lessonRows as
      { id: string; position: number; title: string; objective: string; required: boolean }[] | null) ?? []) {
      const { data: actRows } = await supabase
        .from("activities")
        .select("id,position,type,title,required")
        .eq("lesson_id", le.id)
        .order("position");
      const activities: MapActivity[] = [];
      for (const a of (actRows as
        { id: string; position: number; type: string; title: string; required: boolean }[] | null) ?? []) {
        let assessmentId: string | null = null;
        if (QUIZ_LIKE.has(a.type)) {
          const { data: asmt } = await supabase
            .from("assessments")
            .select("id")
            .eq("activity_id", a.id)
            .limit(1)
            .maybeSingle();
          assessmentId = (asmt as { id: string } | null)?.id ?? null;
        }
        activities.push({
          id: a.id,
          position: a.position,
          type: a.type,
          title: a.title,
          required: a.required,
          completed: completed.has(a.id),
          locked: false,
          assessmentId,
        });
      }
      lessons.push({
        id: le.id,
        position: le.position,
        title: le.title,
        objective: le.objective,
        required: le.required,
        completed: activities.length > 0 && activities.filter((a) => a.required).every((a) => a.completed),
        locked: false,
        activities,
      });
    }
    out.push({ id: md.id, position: md.position, title: md.title, lessons });
  }

  // Unlock server-side (prerequisites; tanpa baris → semua available).
  const allIds: string[] = [];
  const edges = new Map<string, string[]>();
  for (const md of out)
    for (const le of md.lessons) {
      allIds.push(le.id);
      for (const a of le.activities) allIds.push(a.id);
    }
  const { data: prereqRows } = await supabase.from("prerequisites").select("target_id,required_id");
  for (const p of (prereqRows as { target_id: string; required_id: string }[] | null) ?? []) {
    const arr = edges.get(p.target_id) ?? [];
    arr.push(p.required_id);
    edges.set(p.target_id, arr);
  }
  const unlock = computeUnlock(
    allIds,
    completed,
    [...edges.entries()].map(([targetId, requiredIds]) => ({ targetId, requiredIds })),
  );
  return out.map((md) => ({
    ...md,
    lessons: md.lessons.map((le) => ({
      ...le,
      locked: unlock.get(le.id) === "locked",
      activities: le.activities.map((a) => ({ ...a, locked: unlock.get(a.id) === "locked" })),
    })),
  }));
}

/** Fallback enrollment bila query kosong (perilaku sama dengan /learn). */
async function firstActiveEnrollment(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", userId)
    .eq("status", "active")
    .limit(1);
  return ((data as { id: string }[] | null) ?? [])[0]?.id ?? null;
}

export default async function LevelMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enrollment?: string }>;
}) {
  const { id: levelId } = await params;
  const { enrollment } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;

  const { data: levelRow } = await supabase
    .from("levels")
    .select("id,title,objective,passing_score")
    .eq("id", levelId)
    .single();
  const level = levelRow as { id: string; title: string; objective: string; passing_score: number } | null;
  if (!level) notFound();

  const enrollmentId = enrollment || (userId ? await firstActiveEnrollment(userId) : null);
  if (!enrollmentId || !userId) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert" className="rounded-xl border p-5">
          Belum ada enrollment aktif. Hubungi guru Anda untuk didaftarkan ke kelas.
        </p>
      </main>
    );
  }

  let modules: Awaited<ReturnType<typeof getLevelMap>>;
  try {
    modules = await getLevelMap(levelId, enrollmentId);
  } catch {
    modules = null;
  }

  const allDone =
    (modules?.length ?? 0) > 0 && modules!.every((md) => md.lessons.every((le) => le.completed));

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
        Peta level
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{level.title}</h1>
      {level.objective && <p className="mt-2 text-slate-600 dark:text-slate-300">{level.objective}</p>}
      {allDone && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        >
          ✓ Semua aktivitas level ini selesai — lanjut ke level berikutnya dari dashboard.
        </p>
      )}

      {modules === null ? (
        <p role="alert" className="mt-6 rounded-xl border p-5">
          Peta level tidak dapat dimuat. Coba lagi nanti.
        </p>
      ) : modules.length === 0 ? (
        <p role="status" className="mt-6 rounded-xl border p-5">
          Level ini belum memiliki modul/aktivitas.
        </p>
      ) : (
        <ol className="mt-6 space-y-6">
          {modules.map((md, mi) => (
            <li key={md.id}>
              <h2 className="text-lg font-bold">
                {mi + 1}. {md.title}
              </h2>
              <ol className="mt-3 space-y-3">
                {md.lessons.map((le, li) => (
                  <li
                    key={le.id}
                    className="rounded-2xl border bg-white p-4 shadow-[var(--shadow-soft)] dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {mi + 1}.{li + 1} {le.title}
                        {!le.required && <span className="ml-2 text-xs text-slate-400">(opsional)</span>}
                      </p>
                      {le.completed ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                          ✓ Selesai
                        </span>
                      ) : le.locked ? (
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-500">
                          🔒 Terkunci
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                          Tersedia
                        </span>
                      )}
                    </div>
                    {le.objective && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{le.objective}</p>
                    )}
                    <ol className="mt-3 space-y-1.5">
                      {le.activities.map((a) => (
                        <li key={a.id}>
                          {a.locked ? (
                            <span className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:bg-slate-800">
                              🔒 {a.position + 1}. {a.title}
                            </span>
                          ) : (
                            <Link
                              href={`/activities/${a.id}?enrollment=${enrollmentId}`}
                              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-blue-50 dark:hover:bg-slate-800 ${
                                a.completed
                                  ? "bg-emerald-50 dark:bg-emerald-950"
                                  : "bg-slate-50 dark:bg-slate-800"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="font-medium">{a.position + 1}.</span>
                                {a.completed && <span aria-hidden="true">✓</span>}
                                <span>{a.title}</span>
                              </span>
                              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                                {activityBadge(a.type)}
                              </span>
                            </Link>
                          )}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 text-sm text-slate-500">
        <Link href="/learn" className="underline">
          Kembali ke dashboard
        </Link>
      </p>
    </main>
  );
}
