import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** Ekspor roster cohort milik guru (CSV, anti formula-injection via lib/csv). */
export async function GET(_req: Request, { params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!uid) return new Response("UNAUTHENTICATED", { status: 401 });

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id,name,academic_year")
    .eq("id", cohortId)
    .eq("teacher_id", uid)
    .single();
  const c = cohort as { id: string; name: string; academic_year: string } | null;
  if (!c) return new Response("FORBIDDEN", { status: 403 });

  const { data: members } = await supabase
    .from("cohort_members")
    .select("student_id,status")
    .eq("cohort_id", c.id)
    .order("student_id");
  const rows: (string | number | null)[][] = [];
  for (const m of (members as { student_id: string; status: string }[] | null) ?? []) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", m.student_id)
      .single();
    rows.push([
      (prof as { display_name: string } | null)?.display_name ?? m.student_id.slice(0, 8),
      m.student_id,
      m.status,
    ]);
  }
  const csv = toCsv(["Nama", "Student ID", "Status"], rows);
  const safeName = c.name.replace(/[^a-zA-Z0-9_-]+/g, "_") || "roster";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="roster-${safeName}.csv"`,
    },
  });
}
