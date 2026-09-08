import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang, mkT } from "@/lib/i18n";
import { LEVEL } from "@/lib/ui-text/level";
import { LevelManager, type ManagerModule } from "./level-manager";
import { ContentBulkImport } from "./content-bulk-import";

export const dynamic = "force-dynamic";

async function getLevelTree(levelId: string) {
  const supabase = await createClient();
  const { data: lv } = await supabase
    .from("levels")
    .select("id,title,objective,course_version_id")
    .eq("id", levelId)
    .single();
  const level = lv as { id: string; title: string; objective: string; course_version_id: string } | null;
  if (!level) return null;
  const { data: courseVersions } = await supabase
    .from("course_versions")
    .select("course_id")
    .eq("id", level.course_version_id)
    .single();
  const courseId = (courseVersions as { course_id: string } | null)?.course_id ?? "";
  const { data: moduleRows } = await supabase
    .from("modules")
    .select("id,position,title")
    .eq("level_id", levelId)
    .order("position");
  const modules: ManagerModule[] = [];
  for (const md of (moduleRows as { id: string; position: number; title: string }[] | null) ?? []) {
    const { data: lessonRows } = await supabase
      .from("lessons")
      .select("id,position,title,objective")
      .eq("module_id", md.id)
      .order("position");
    const lessons: ManagerModule["lessons"] = [];
    for (const le of (lessonRows as
      { id: string; position: number; title: string; objective: string }[] | null) ?? []) {
      const { data: actRows } = await supabase
        .from("activities")
        .select("id,position,type,title")
        .eq("lesson_id", le.id)
        .order("position");
      lessons.push({
        id: le.id,
        position: le.position,
        title: le.title,
        objective: le.objective,
        activities: (
          (actRows as { id: string; position: number; type: string; title: string }[] | null) ?? []
        ).map((a) => ({ ...a })),
      });
    }
    modules.push({ id: md.id, position: md.position, title: md.title, lessons });
  }
  return { level, courseId, modules };
}

export default async function LevelPage({ params }: { params: Promise<{ id: string; levelId: string }> }) {
  const lang = await getLang();
  const t = mkT(LEVEL, lang);
  const { id, levelId } = await params;
  let data: Awaited<ReturnType<typeof getLevelTree>>;
  try {
    data = await getLevelTree(levelId);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <p role="alert">{t("loadFailed")}</p>
      </main>
    );
  }
  if (!data) notFound();
  void id;

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/teacher/courses/${data.courseId}`} className="text-sm text-blue-700 underline">
        {t("backToManageCourse")}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{data.level.title}</h1>
      <p className="mt-1 text-slate-600">
        {t("objectivePrefix")}
        {data.level.objective || <em className="text-red-700">{t("objectiveEmpty")}</em>}
      </p>
      <LevelManager levelId={data.level.id} initialModules={data.modules} lang={lang} />
      <div className="mt-4">
        <ContentBulkImport courseId={data.courseId} levelId={data.level.id} lang={lang} />
      </div>
    </main>
  );
}
