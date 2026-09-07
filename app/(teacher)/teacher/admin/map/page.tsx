import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgAdminContext } from "@/lib/org-admin";
import { TeacherBulkImport } from "./teacher-bulk-import";
import { AssignmentBulkImport } from "./assignment-bulk-import";
import { MappingPanel } from "./mapping-panel";

export const dynamic = "force-dynamic";

export interface AdminMapData {
  cohorts: { id: string; name: string; academicYear: string; teacherId: string }[];
  courses: { id: string; title: string }[];
  students: { id: string; displayName: string }[];
  teachers: { id: string; displayName: string }[];
}

async function loadOrgData(orgId: string): Promise<AdminMapData> {
  // Admin org = pengecualian yang disengaja: membaca data org-wide (kelas, subjek,
  // murid, guru) via service client — RBAC guru biasa TETAP cohort-scoped, dan
  // hanya org-admin (guru pemilik course) yang sampai di sini (getOrgAdminContext).
  const svc = createServiceClient();

  const [{ data: cohortRows }, { data: courseRows }, { data: memberRows }, { data: teacherRows }] =
    await Promise.all([
      svc.from("cohorts").select("id,name,academic_year,teacher_id").eq("organization_id", orgId),
      svc.from("courses").select("id,title").eq("organization_id", orgId),
      svc
        .from("memberships")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("role", "student")
        .eq("status", "active"),
      svc
        .from("memberships")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("role", "teacher")
        .eq("status", "active"),
    ]);

  const cohorts = (
    (cohortRows as { id: string; name: string; academic_year: string; teacher_id: string }[] | null) ?? []
  ).map((c) => ({ id: c.id, name: c.name, academicYear: c.academic_year, teacherId: c.teacher_id }));
  const courses = ((courseRows as { id: string; title: string }[] | null) ?? []).map((c) => ({
    id: c.id,
    title: c.title,
  }));

  const studentIds = ((memberRows as { user_id: string }[] | null) ?? []).map((m) => m.user_id);
  const teacherIds = ((teacherRows as { user_id: string }[] | null) ?? []).map((m) => m.user_id);
  const ids = [...new Set([...studentIds, ...teacherIds])];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await svc.from("profiles").select("id,display_name").in("id", ids);
    for (const p of (profs as { id: string; display_name: string }[] | null) ?? []) {
      names.set(p.id, p.display_name);
    }
  }
  const nameOf = (id: string) => names.get(id) ?? id.slice(0, 8);

  return {
    cohorts,
    courses,
    students: studentIds.map((id) => ({ id, displayName: nameOf(id) })),
    teachers: teacherIds.map((id) => ({ id, displayName: nameOf(id) })),
  };
}

export default async function AdminMapPage() {
  const ctx = await getOrgAdminContext();
  if (!ctx) {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <p role="alert" className="rounded-xl border border-red-200 p-4">
          Halaman admin hanya untuk guru yang memiliki course di organisasi ini (facet Owner, ADR-008).{" "}
          <Link href="/teacher" className="text-blue-700 underline">
            Kembali ke dashboard
          </Link>
          .
        </p>
      </main>
    );
  }

  let data: AdminMapData;
  try {
    data = await loadOrgData(ctx.orgId);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <p role="alert">Data admin tidak dapat dimuat.</p>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-slate-500">
        <Link href="/teacher" className="text-blue-700 underline">
          ← Dashboard
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-bold">Admin — mapping kelas &amp; subjek</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Kelola guru, murid, dan penugasannya ke kelas (cohort) dan subjek (course). Import identitas via XLSX,
        lalu rapikan mapping secara manual di panel bawah.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <TeacherBulkImport />
        <AssignmentBulkImport />
      </div>

      <MappingPanel data={data} />
    </main>
  );
}
