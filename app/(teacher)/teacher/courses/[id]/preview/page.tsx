import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmt, getLang, mkT } from "@/lib/i18n";
import { COURSE } from "@/lib/ui-text/course";

export const dynamic = "force-dynamic";

interface PreviewActivity {
  id: string;
  position: number;
  type: string;
  title: string;
}
interface PreviewLesson {
  id: string;
  position: number;
  title: string;
  activities: PreviewActivity[];
}
interface PreviewLevel {
  id: string;
  position: number;
  title: string;
  lessons: PreviewLesson[];
}

/** Preview-as-student: guru melihat struktur published/draft persis urutan murid, tanpa nilai. */
async function getPreview(courseId: string): Promise<{ title: string; levels: PreviewLevel[] } | null> {
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id,title").eq("id", courseId).single();
  const c = course as { id: string; title: string } | null;
  if (!c) return null;
  const { data: versions } = await supabase
    .from("course_versions")
    .select("id")
    .eq("course_id", courseId)
    .order("version", { ascending: false })
    .limit(1);
  const v = ((versions as { id: string }[] | null) ?? [])[0];
  if (!v) return { title: c.title, levels: [] };

  const { data: levelRows } = await supabase
    .from("levels")
    .select("id,position,title")
    .eq("course_version_id", v.id)
    .order("position");
  const levels: PreviewLevel[] = [];
  for (const lv of (levelRows as { id: string; position: number; title: string }[] | null) ?? []) {
    const { data: moduleRows } = await supabase.from("modules").select("id").eq("level_id", lv.id);
    const lessons: PreviewLesson[] = [];
    for (const md of (moduleRows as { id: string }[] | null) ?? []) {
      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("id,position,title")
        .eq("module_id", md.id)
        .order("position");
      for (const le of (lessonRows as { id: string; position: number; title: string }[] | null) ?? []) {
        const { data: actRows } = await supabase
          .from("activities")
          .select("id,position,type,title")
          .eq("lesson_id", le.id)
          .order("position");
        lessons.push({
          id: le.id,
          position: le.position,
          title: le.title,
          activities: ((actRows as PreviewActivity[] | null) ?? []).map((a) => ({ ...a })),
        });
      }
    }
    lessons.sort((a, b) => a.position - b.position);
    levels.push({ id: lv.id, position: lv.position, title: lv.title, lessons });
  }
  return { title: c.title, levels };
}

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const lang = await getLang();
  const t = mkT(COURSE, lang);
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getPreview>>;
  try {
    data = await getPreview(id);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert">{t("previewLoadFailed")}</p>
      </main>
    );
  }
  if (!data) notFound();

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/teacher/courses/${id}`} className="text-sm text-blue-700 underline">
        {t("backToManageCourse")}
      </Link>
      <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
        {t("previewBadge")}
      </p>
      <h1 className="mt-2 text-3xl font-bold">{data.title}</h1>
      {data.levels.length === 0 ? (
        <p className="mt-6 rounded-xl border p-5">{t("previewNoContent")}</p>
      ) : (
        <ol className="mt-6 space-y-4">
          {data.levels.map((lv, li) => (
            <li key={lv.id} className="rounded-xl border p-4">
              <h2 className="font-bold">{fmt(t("previewLevel"), { n: li + 1, title: lv.title })}</h2>
              {lv.lessons.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">{t("previewNoLessons")}</p>
              ) : (
                <ol className="mt-2 space-y-2 pl-4">
                  {lv.lessons.map((le, lej) => (
                    <li key={le.id} className="rounded-lg bg-slate-50 p-3">
                      <h3 className="font-semibold">
                        {fmt(t("previewLesson"), { n: lej + 1, title: le.title })}
                      </h3>
                      <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                        {le.activities.map((a) => (
                          <li key={a.id}>
                            {a.title} <span className="text-slate-500">({a.type})</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
