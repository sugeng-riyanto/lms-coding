import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { summarizeCohort, type StudentRow } from "@/lib/analytics";
import { detectRisk } from "@/lib/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { AlertControls } from "./alert-controls";

export const dynamic = "force-dynamic";

interface Alert {
  id: string;
  student_id: string;
  code: string;
  message: string;
  status: string;
  studentName: string;
}

async function getDashboard(userId: string, cohortId: string | null) {
  const supabase = await createClient();
  const { data: cohorts } = await supabase.from("cohorts").select("id,name").eq("teacher_id", userId);
  const list = (cohorts as { id: string; name: string }[] | null) ?? [];
  const active = list.find((c) => c.id === cohortId) ?? list[0];
  if (!active)
    return {
      cohorts: list,
      active: null as null | { id: string; name: string },
      rows: [] as StudentRow[],
      alerts: [] as Alert[],
      pending: 0,
      recent: [] as { id: string; label: string }[],
    };

  const { data: members } = await supabase
    .from("cohort_members")
    .select("student_id")
    .eq("cohort_id", active.id);
  const studentIds = ((members as { student_id: string }[] | null) ?? []).map((m) => m.student_id);
  const rows: StudentRow[] = [];
  for (const sid of studentIds) {
    const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", sid).single();
    const { data: enr } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", sid)
      .eq("cohort_id", active.id)
      .eq("status", "active")
      .limit(1)
      .single();
    const enrollmentId = (enr as { id: string } | null)?.id;
    let progressPct = 0;
    let mastery = 0;
    let lastActivity: string | null = null;
    if (enrollmentId) {
      const { data: snaps } = await supabase
        .from("progress_snapshots")
        .select("percent,mastery,last_activity_at")
        .eq("enrollment_id", enrollmentId)
        .eq("entity_type", "lesson");
      const ss =
        (snaps as { percent: number; mastery: number; last_activity_at: string | null }[] | null) ?? [];
      if (ss.length > 0) {
        progressPct = ss.reduce((a, s) => a + Number(s.percent), 0) / ss.length;
        mastery = ss.reduce((a, s) => a + Number(s.mastery), 0) / ss.length;
        lastActivity =
          ss
            .map((s) => s.last_activity_at)
            .filter(Boolean)
            .sort()
            .pop() ?? null;
      }
    }
    const { count } = await supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", enrollmentId ?? "00000000-0000-0000-0000-000000000000")
      .neq("status", "in_progress");
    rows.push({
      studentId: sid,
      displayName: (prof as { display_name: string } | null)?.display_name ?? sid.slice(0, 8),
      progressPct: Math.round(progressPct),
      mastery: Math.round(mastery * 100) / 100,
      lastActivityAt: lastActivity,
      submittedCount: count ?? 0,
    });
  }

  const { data: alertRows } = await supabase
    .from("alerts")
    .select("id,student_id,code,message,status")
    .eq("cohort_id", active.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);
  const alerts: Alert[] = [];
  for (const a of (alertRows as
    { id: string; student_id: string; code: string; message: string; status: string }[] | null) ?? []) {
    const row = rows.find((r) => r.studentId === a.student_id);
    alerts.push({ ...a, studentName: row?.displayName ?? a.student_id.slice(0, 8) });
  }

  // Auto-sinyal dihitung live (explainable); guru menindaklanjuti via AlertControls (persist alerts).
  const autoSignals: Alert[] = [];
  for (const r of rows) {
    const inactiveDays = r.lastActivityAt
      ? Math.round((Date.now() - Date.parse(r.lastActivityAt)) / 86400000)
      : 999;
    for (const s of detectRisk({
      inactiveDays,
      attemptsLast7d: 0,
      scoreDelta: 0,
      avgSecondsPerItem: 60,
      accuracy: 1,
      prereqMastery: 1,
      progressPct: r.progressPct,
      expectedPct: 70,
    })) {
      autoSignals.push({
        id: `auto-${r.studentId}-${s.code}`,
        student_id: r.studentId,
        code: s.code,
        message: s.message,
        status: "open",
        studentName: r.displayName,
      });
    }
  }

  return {
    cohorts: list,
    active,
    rows,
    alerts: [...alerts, ...autoSignals],
    pending: 0,
    recent: [] as { id: string; label: string }[],
  };
}

export default async function TeacherPage({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  const { cohort } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub ?? "";
  let data: Awaited<ReturnType<typeof getDashboard>>;
  try {
    data = await getDashboard(userId, cohort ?? null);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <p role="alert">Dashboard tidak dapat dimuat.</p>
      </main>
    );
  }
  if (!data.active) {
    return (
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">Dashboard kelas</h1>
        <p className="mt-4 rounded-xl border p-5" role="status">
          Belum ada cohort yang Anda ampu.
        </p>
      </main>
    );
  }
  const summary = summarizeCohort(data.rows);

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Dasbor Kelas</h1>
        <ThemeToggle />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {data.cohorts.map((c) => (
          <Link
            key={c.id}
            href={`/teacher?cohort=${c.id}`}
            className={`rounded-full border px-3 py-1 ${c.id === data.active?.id ? "bg-blue-700 text-white" : ""}`}
          >
            {c.name}
          </Link>
        ))}
        <a
          href={`/api/teacher/export?cohortId=${data.active.id}`}
          className="rounded-full border px-3 py-1 underline"
        >
          Export CSV
        </a>
      </div>

      <section aria-label="Ringkasan" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Terdaftar", String(summary.enrolled)],
          ["Aktif 7 hari", String(summary.active7d)],
          ["Rata-rata progress", `${Math.round(summary.avgProgress)}%`],
          ["Rata-rata mastery", `${Math.round(summary.avgMastery * 100)}%`],
          ["Perlu perhatian", String(summary.needsAttention)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-4">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-slate-600">{label}</p>
          </div>
        ))}
      </section>
      <p className="mt-2 text-xs text-slate-500">
        Definisi metrik v2026-09-06/v1 · n={summary.enrolled} · diperbarui saat halaman dimuat
      </p>

      <h2 className="mt-8 text-xl font-semibold">Matriks cohort</h2>
      {data.rows.length === 0 ? (
        <p className="mt-3 rounded-xl border p-4" role="status">
          Belum ada murid di cohort ini.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="p-2">Murid</th>
                <th className="p-2">Progress</th>
                <th className="p-2">Mastery</th>
                <th className="p-2">Submit</th>
                <th className="p-2">Status</th>
                <th className="p-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.studentId} className="border-b">
                  <td className="p-2 font-semibold">{r.displayName}</td>
                  <td className="p-2">{r.progressPct}%</td>
                  <td className="p-2">{Math.round(r.mastery * 100)}%</td>
                  <td className="p-2">{r.submittedCount}</td>
                  <td className="p-2">{r.progressPct < 50 ? "⚠ Perlu perhatian" : "✓ On-track"}</td>
                  <td className="p-2">
                    <Link
                      href={`/teacher/students/${r.studentId}?cohort=${data.active?.id}`}
                      className="text-blue-700 underline"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 text-xl font-semibold">Sinyal risiko (explainable)</h2>
      <AlertControls cohortId={data.active.id} alerts={data.alerts} />
      <p className="mt-4 text-sm">
        <Link href="/teacher/grading" className="text-blue-700 underline">
          Antrian penilaian manual
        </Link>
        {" · "}
        <Link href="/teacher/questions" className="text-blue-700 underline">
          Bank soal
        </Link>
        {" · "}
        <Link href="/teacher/cohorts" className="text-blue-700 underline">
          Cohort & enrollment
        </Link>
        {" · "}
        <Link href="/teacher/analytics" className="text-blue-700 underline">
          Analitik kelas
        </Link>
        {" · "}
        <Link href="/teacher/certificates" className="text-blue-700 underline">
          Sertifikat &amp; anchoring
        </Link>
      </p>
    </main>
  );
}
