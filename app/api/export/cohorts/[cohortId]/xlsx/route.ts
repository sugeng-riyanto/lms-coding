import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildXlsxBuffer, xlsxDownloadHeaders } from "@/lib/bulk-xlsx";

export const dynamic = "force-dynamic";

/** Ekspor roster cohort milik guru (XLSX). Kolom = template impor
 * (Email, Nama) + Status sehingga hasil unduhan bisa diedit lalu
 * diimpor ulang (round-trip). Email diambil via service SETELAH cek
 * kepemilikan cohort — guru memang mengelola cohort ini. */
export async function GET(_req: Request, { params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!uid) return new Response("UNAUTHENTICATED", { status: 401 });

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id,name")
    .eq("id", cohortId)
    .eq("teacher_id", uid)
    .single();
  const c = cohort as { id: string; name: string } | null;
  if (!c) return new Response("FORBIDDEN", { status: 403 });

  const { data: members } = await supabase
    .from("cohort_members")
    .select("student_id,status")
    .eq("cohort_id", c.id)
    .order("student_id");
  const mems = (members as { student_id: string; status: string }[] | null) ?? [];
  const ids = mems.map((m) => m.student_id);

  const svc = createServiceClient();
  const names = new Map<string, string>();
  const emails = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await svc.from("profiles").select("id,display_name").in("id", ids);
    for (const p of (profs as { id: string; display_name: string }[] | null) ?? []) {
      names.set(p.id, p.display_name);
    }
    // Email via Auth Admin API — PostgREST tidak mengekspos skema auth (406).
    const wanted = new Set(ids);
    for (let page = 1; page <= 25; page++) {
      const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
      const users = error ? [] : (data?.users ?? []);
      for (const u of users) {
        if (u.id && u.email && wanted.has(u.id)) emails.set(u.id, u.email);
      }
      if (users.length < 200) break;
    }
  }

  const rows = mems.map((m) => [
    emails.get(m.student_id) ?? "",
    names.get(m.student_id) ?? m.student_id.slice(0, 8),
    m.status,
  ]);
  const buf = buildXlsxBuffer("Roster", ["Email", "Nama", "Status"], rows);
  const safeName = c.name.replace(/[^a-zA-Z0-9_-]+/g, "_") || "roster";
  return new Response(new Uint8Array(buf), {
    headers: xlsxDownloadHeaders(`roster-${safeName}.xlsx`),
  });
}
