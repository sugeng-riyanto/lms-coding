import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeUnlock } from "@/lib/progress";

export const dynamic = "force-dynamic";

interface CatalogCourse {
  enrollmentId: string;
  courseId: string;
  title: string;
  description: string;
  levels: { id: string; position: number; title: string; status: string }[];
}

/** Katalog murid: hanya enrollment aktif + versi published, unlock dihitung server-side. */
async function getCatalog(userId: string): Promise<CatalogCourse[]> {
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id,course_id,courses(id,title,description)")
    .eq("student_id", userId)
    .eq("status", "active");
  const out: CatalogCourse[] = [];
  for (const e of (enrollments as
    | { id: string; course_id: string; courses: { id: string; title: string; description: string } | null }[]
    | null) ?? []) {
    if (!e.courses) continue;
    const { data: versions } = await supabase
      .from("course_versions")
      .select("id")
      .eq("course_id", e.course_id)
      .not("published_at", "is", null)
      .order("version", { ascending: false })
      .limit(1);
    const v = ((versions as { id: string }[] | null) ?? [])[0];
    if (!v) continue;
    const { data: levelRows } = await supabase
      .from("levels")
      .select("id,position,title")
      .eq("course_version_id", v.id)
      .order("position");
    const levels = (levelRows as { id: string; position: number; title: string }[] | null) ?? [];
    const { data: snaps } = await supabase
      .from("progress_snapshots")
      .select("entity_id,status")
      .eq("enrollment_id", e.id)
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
      levels.map((l) => l.id),
      completed,
      [...edges.entries()].map(([targetId, requiredIds]) => ({ targetId, requiredIds })),
    );
    out.push({
      enrollmentId: e.id,
      courseId: e.course_id,
      title: e.courses.title,
      description: e.courses.description,
      levels: levels.map((l) => ({ ...l, status: unlock.get(l.id) ?? "locked" })),
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
      <h1 className="text-3xl font-bold">Katalog belajarku</h1>
      {courses.length === 0 ? (
        <p className="mt-6 rounded-xl border p-5" role="status">
          Belum ada enrollment aktif pada course published. Hubungi guru Anda.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {courses.map((c) => (
            <section key={c.courseId} aria-label={c.title} className="rounded-xl border p-5">
              <h2 className="text-xl font-bold">{c.title}</h2>
              <p className="text-sm text-slate-600">{c.description}</p>
              <ol className="mt-3 space-y-2">
                {c.levels.map((l, i) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span>
                      <strong>{i + 1}.</strong> {l.title}
                    </span>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold">
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
                href="/learn"
                className="mt-3 inline-block rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
              >
                Lanjutkan belajar
              </Link>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
