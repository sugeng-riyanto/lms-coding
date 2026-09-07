import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeUnlock } from "@/lib/progress";

export const dynamic = "force-dynamic";

interface CatalogCourse {
  enrollmentId: string | null;
  courseId: string;
  title: string;
  description: string;
  enrolled: boolean;
  levels: { id: string; position: number; title: string; status: string }[];
}

/** Katalog murid: SEMUA kursus published (metadata) + status enrollment + unlock server-side. */
async function getCatalog(userId: string): Promise<CatalogCourse[]> {
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id,course_id")
    .eq("student_id", userId)
    .eq("status", "active");
  const enrolledByCourse = new Map<string, string>();
  for (const e of (enrollments as { id: string; course_id: string }[] | null) ?? []) {
    enrolledByCourse.set(e.course_id, e.id);
  }

  const { data: courseRows } = await supabase
    .from("courses")
    .select("id,title,description")
    .eq("status", "published")
    .order("title");
  const out: CatalogCourse[] = [];
  for (const course of (courseRows as { id: string; title: string; description: string }[] | null) ?? []) {
    const { data: versions } = await supabase
      .from("course_versions")
      .select("id")
      .eq("course_id", course.id)
      .not("published_at", "is", null)
      .order("version", { ascending: false })
      .limit(1);
    const v = ((versions as { id: string }[] | null) ?? [])[0];
    if (!v) continue;
    const enrollmentId = enrolledByCourse.get(course.id) ?? null;
    let levels: CatalogCourse["levels"] = [];
    if (enrollmentId) {
      const { data: levelRows } = await supabase
        .from("levels")
        .select("id,position,title")
        .eq("course_version_id", v.id)
        .order("position");
      const rows = (levelRows as { id: string; position: number; title: string }[] | null) ?? [];
      const { data: snaps } = await supabase
        .from("progress_snapshots")
        .select("entity_id,status")
        .eq("enrollment_id", enrollmentId)
        .eq("entity_type", "level");
      const completed = new Set(
        ((snaps as { entity_id: string; status: string }[] | null) ?? [])
          .filter((s) => s.status === "completed")
          .map((s) => s.entity_id),
      );
      const { data: prereqs } = await supabase.from("prerequisites").select("target_id,required_id");
      const edges = new Map<string, string[]>();
      for (const p of (prereqs as { target_id: string; required_id: string }[] | null) ?? []) {
        const arr = edges.get(p.target_id) ?? [];
        arr.push(p.required_id);
        edges.set(p.target_id, arr);
      }
      const unlock = computeUnlock(
        rows.map((l) => l.id),
        completed,
        [...edges.entries()].map(([targetId, requiredIds]) => ({ targetId, requiredIds })),
      );
      levels = rows.map((l) => ({ ...l, status: unlock.get(l.id) ?? "locked" }));
    }
    out.push({
      enrollmentId,
      courseId: course.id,
      title: course.title,
      description: course.description,
      enrolled: Boolean(enrollmentId),
      levels,
    });
  }
  return out;
}

export default async function CatalogPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert">Anda belum masuk.</p>
      </main>
    );
  }
  let courses: CatalogCourse[];
  try {
    courses = await getCatalog(userId);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert">Katalog tidak dapat dimuat. Coba lagi nanti.</p>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Katalog pembelajaran</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Semua kursus yang tersedia di sekolah Anda. Kursus yang sudah terdaftar bisa langsung dilanjutkan;
        kursus lain dapat didaftarkan oleh guru/administrator.
      </p>
      {courses.length === 0 ? (
        <p className="mt-6 rounded-xl border p-5" role="status">
          Belum ada kursus published. Hubungi guru Anda.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {courses.map((c) => (
            <section
              key={c.courseId}
              aria-label={c.title}
              className="rounded-2xl border bg-white p-5 shadow-[var(--shadow-soft)] dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold">{c.title}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    c.enrolled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  }`}
                >
                  {c.enrolled ? "Terdaftar" : "Tersedia"}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{c.description}</p>
              {c.enrolled ? (
                <>
                  <ol className="mt-3 space-y-2">
                    {c.levels.map((l, i) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
                      >
                        <span>
                          <strong>{i + 1}.</strong> {l.title}
                        </span>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold dark:bg-slate-700">
                          {l.status === "completed"
                            ? "Completed"
                            : l.status === "locked"
                              ? "Locked"
                              : "Available"}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <Link
                    href={`/learn?enrollment=${c.enrollmentId}`}
                    className="mt-3 inline-block rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-semibold text-white shadow-[var(--glow-btn)] transition hover:from-blue-700 hover:to-indigo-700"
                  >
                    Lanjutkan belajar
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Belum terdaftar di kursus ini. Minta guru/administrator mendaftarkan Anda (enrollment
                  dilakukan pihak sekolah).
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
