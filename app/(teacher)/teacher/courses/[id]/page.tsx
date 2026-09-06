import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ManageCourse } from "./manage-course";

export const dynamic = "force-dynamic";

async function getManageData(courseId: string) {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id,title,status")
    .eq("id", courseId)
    .single();
  const c = course as { id: string; title: string; status: string } | null;
  if (!c) return null;
  const { data: versions } = await supabase
    .from("course_versions")
    .select("id,version,published_at")
    .eq("course_id", courseId)
    .order("version", { ascending: false })
    .limit(1);
  const v = ((versions as { id: string; version: number; published_at: string | null }[] | null) ?? [])[0];
  if (!v) return { course: c, version: null, levels: [] };
  const { data: levels } = await supabase
    .from("levels")
    .select("id,position,title")
    .eq("course_version_id", v.id)
    .order("position");
  return {
    course: c,
    version: v,
    levels: ((levels as { id: string; position: number; title: string }[] | null) ?? []).map((l) => ({
      id: l.id,
      position: l.position,
      title: l.title,
    })),
  };
}

export default async function ManageCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getManageData>>;
  try {
    data = await getManageData(id);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert">Data course tidak dapat dimuat.</p>
      </main>
    );
  }
  if (!data) notFound();

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/teacher" className="text-sm text-blue-700 underline">
        ← Dashboard guru
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{data.course.title}</h1>
      <p className="mt-1 text-slate-600">
        Status: <strong>{data.course.status}</strong>
        {data.version ? (
          <>
            {" "}
            · Versi {data.version.version} ·{" "}
            {data.version.published_at ? `terbit ${data.version.published_at}` : "draft (belum terbit)"}
          </>
        ) : (
          " · tanpa versi"
        )}
      </p>
      {data.version ? (
        <div data-version-id={data.version.id}>
          <ManageCourse courseId={data.course.id} versionId={data.version.id} initialLevels={data.levels} />
        </div>
      ) : (
        <p className="mt-6 rounded-xl border p-5">Belum ada versi course.</p>
      )}
    </main>
  );
}
