import { createClient } from "@/lib/supabase/server";
import { buildXlsxBuffer, xlsxDownloadHeaders } from "@/lib/bulk-xlsx";

export const dynamic = "force-dynamic";

/** Ekspor materi kursus milik guru (XLSX, versi terbaru). Kolom = template
 * impor (Module, Lesson, Objective, Activity Type, Activity Title,
 * Content JSON) sehingga hasil unduhan bisa diedit lalu diimpor ulang
 * ke level draf (round-trip). */
export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!uid) return new Response("UNAUTHENTICATED", { status: 401 });

  const { data: course } = await supabase
    .from("courses")
    .select("id,slug")
    .eq("id", courseId)
    .eq("owner_id", uid)
    .single();
  const co = course as { id: string; slug: string } | null;
  if (!co) return new Response("FORBIDDEN", { status: 403 });

  const { data: versions } = await supabase
    .from("course_versions")
    .select("id")
    .eq("course_id", co.id)
    .order("version", { ascending: false })
    .limit(1);
  const version = ((versions as { id: string }[] | null) ?? [])[0];
  if (!version) return new Response("EMPTY_VERSION", { status: 404 });

  const rows: string[][] = [];
  const { data: levels } = await supabase
    .from("levels")
    .select("id")
    .eq("course_version_id", version.id)
    .order("position");
  for (const lv of (levels as { id: string }[] | null) ?? []) {
    const { data: mods } = await supabase
      .from("modules")
      .select("id,title")
      .eq("level_id", lv.id)
      .order("position");
    for (const md of (mods as { id: string; title: string }[] | null) ?? []) {
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id,title,objective")
        .eq("module_id", md.id)
        .order("position");
      for (const le of (lessons as { id: string; title: string; objective: string | null }[] | null) ?? []) {
        const { data: acts } = await supabase
          .from("activities")
          .select("type,title,content_json")
          .eq("lesson_id", le.id)
          .order("position");
        const list = (acts as { type: string; title: string; content_json: unknown }[] | null) ?? [];
        if (list.length === 0) {
          rows.push([md.title, le.title, le.objective ?? "", "", "", ""]);
          continue;
        }
        for (const a of list) {
          const content =
            a.content_json && Object.keys(a.content_json as Record<string, unknown>).length > 0
              ? JSON.stringify(a.content_json)
              : "";
          rows.push([md.title, le.title, le.objective ?? "", a.type, a.title, content]);
        }
      }
    }
  }

  const buf = buildXlsxBuffer(
    "Materi",
    ["Module", "Lesson", "Objective", "Activity Type", "Activity Title", "Content JSON"],
    rows,
  );
  const safeSlug = co.slug.replace(/[^a-zA-Z0-9_-]+/g, "_") || "materi";
  return new Response(new Uint8Array(buf), { headers: xlsxDownloadHeaders(`materi-${safeSlug}.xlsx`) });
}
