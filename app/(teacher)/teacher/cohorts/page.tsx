import { createClient } from "@/lib/supabase/server";
import { CohortManager } from "./cohort-manager";

export const dynamic = "force-dynamic";

export interface CohortInfo {
  id: string;
  name: string;
  academicYear: string;
  members: { studentId: string; displayName: string; status: string }[];
  enrollments: { id: string; studentId: string; studentName: string; courseTitle: string; status: string }[];
}

async function getCohorts(userId: string, myCourseIds: string[], myCourseTitles: Map<string, string>) {
  const supabase = await createClient();
  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("id,name,academic_year")
    .eq("teacher_id", userId)
    .order("created_at");
  const out: CohortInfo[] = [];
  for (const c of (cohorts as { id: string; name: string; academic_year: string }[] | null) ?? []) {
    const { data: members } = await supabase
      .from("cohort_members")
      .select("student_id,status")
      .eq("cohort_id", c.id);
    const mems: CohortInfo["members"] = [];
    for (const m of (members as { student_id: string; status: string }[] | null) ?? []) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", m.student_id)
        .single();
      mems.push({
        studentId: m.student_id,
        displayName: (prof as { display_name: string } | null)?.display_name ?? m.student_id.slice(0, 8),
        status: m.status,
      });
    }
    const { data: enrs } = await supabase
      .from("enrollments")
      .select("id,student_id,course_id,status")
      .eq("cohort_id", c.id);
    const enrollments: CohortInfo["enrollments"] = [];
    for (const e of (enrs as
      { id: string; student_id: string; course_id: string; status: string }[] | null) ?? []) {
      const mem = mems.find((x) => x.studentId === e.student_id);
      enrollments.push({
        id: e.id,
        studentId: e.student_id,
        studentName: mem?.displayName ?? e.student_id.slice(0, 8),
        courseTitle: myCourseTitles.get(e.course_id) ?? e.course_id.slice(0, 8),
        status: e.status,
      });
    }
    void myCourseIds;
    out.push({ id: c.id, name: c.name, academicYear: c.academic_year, members: mems, enrollments });
  }
  return out;
}

export default async function CohortsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub ?? "";
  const { data: courses } = await supabase.from("courses").select("id,title").eq("owner_id", userId);
  const myCourses = ((courses as { id: string; title: string }[] | null) ?? []).map((c) => ({ ...c }));
  const titles = new Map(myCourses.map((c) => [c.id, c.title]));
  let cohorts: CohortInfo[] = [];
  try {
    cohorts = await getCohorts(
      userId,
      myCourses.map((c) => c.id),
      titles,
    );
  } catch {
    cohorts = [];
  }
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Cohort & enrollment</h1>
      <p className="mt-1 text-sm text-slate-600">
        Suspend enrollment menonaktifkan akses murid tanpa menghapus riwayat.
      </p>
      <CohortManager initialCohorts={cohorts} courses={myCourses} />
    </main>
  );
}
