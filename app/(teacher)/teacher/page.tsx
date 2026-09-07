import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgAdminContext } from "@/lib/org-admin";
import { summarizeCohort, type StudentRow } from "@/lib/analytics";
import { detectRisk } from "@/lib/progress";
import { MeterBar, SectionHeader, StatCard } from "@/components/dashboard";
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
  // Org-admin (facet Owner, ADR-008): guru aktif org yang memiliki ≥1 course —
  // hanya mereka yang melihat tautan admin mapping.
  const adminCtx = await getOrgAdminContext();

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
    <main id="main" className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
            {data.active.name}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Dasbor Kelas</h1>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {data.cohorts.map((c) => (
          <Link
            key={c.id}
            href={`/teacher?cohort=${c.id}`}
            aria-current={c.id === data.active?.id ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 font-medium ${
              c.id === data.active?.id
                ? "border-blue-700 bg-blue-700 text-white"
                : "bg-white hover:bg-slate-50 dark:bg-slate-900"
            }`}
          >
            {c.name}
          </Link>
        ))}
        <a
          href={`/api/teacher/export?cohortId=${data.active.id}`}
          className="rounded-full border border-dashed px-4 py-1.5 font-medium underline"
        >
          Export CSV
        </a>
      </div>

      <section aria-label="Ringkasan" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Terdaftar" value={String(summary.enrolled)} tone="blue" hint="Murid di cohort" />
        <StatCard label="Aktif 7 hari" value={String(summary.active7d)} tone="emerald" hint="Ada aktivitas" />
        <StatCard
          label="Rata-rata progress"
          value={`${Math.round(summary.avgProgress)}%`}
          tone="blue"
          hint="Penyelesaian lesson"
        />
        <StatCard
          label="Rata-rata mastery"
          value={`${Math.round(summary.avgMastery * 100)}%`}
          tone="emerald"
          hint="Penguasaan kompetensi"
        />
        <StatCard
          label="Perlu perhatian"
          value={String(summary.needsAttention)}
          tone={summary.needsAttention > 0 ? "amber" : "slate"}
          hint="Di bawah 50% progress"
        />
      </section>
      <p className="mt-2 text-xs text-slate-500">
        Definisi metrik v2026-09-06/v1 · n={summary.enrolled} · diperbarui saat halaman dimuat
      </p>

      <SectionHeader title="Matriks cohort" hint="Baris murid · status selalu berupa teks" />
      {data.rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900" role="status">
          Belum ada murid di cohort ini.
        </p>
      ) : (
        <>
          {/* Kartu tumpuk untuk layar kecil: tabel 6 kolom tidak muat @360px
              tanpa scroll horizontal (gate responsif). Data & status sama. */}
          <ul className="mt-4 space-y-3 md:hidden">
            {data.rows.map((r) => (
              <li
                key={r.studentId}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2 border-b p-4">
                  <p className="font-bold">
                    <Link
                      href={`/teacher/students/${r.studentId}?cohort=${data.active?.id}`}
                      className="text-blue-700 underline dark:text-blue-300"
                    >
                      {r.displayName}
                    </Link>
                  </p>
                  <span
                    aria-label={`Status ${r.displayName}`}
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      r.progressPct < 50
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {r.progressPct < 50 ? "⚠ Perlu perhatian" : "✓ On-track"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 p-4 text-center">
                  <div>
                    <p className="text-xl font-extrabold">{r.progressPct}%</p>
                    <p className="text-xs text-slate-500">Progress</p>
                    <div className="mt-1">
                      <MeterBar pct={r.progressPct} label={`Progress ${r.displayName}`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold">{Math.round(r.mastery * 100)}%</p>
                    <p className="text-xs text-slate-500">Mastery</p>
                    <div className="mt-1">
                      <MeterBar pct={r.mastery * 100} label={`Mastery ${r.displayName}`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold">{r.submittedCount}</p>
                    <p className="text-xs text-slate-500">Submit</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border bg-white shadow-sm md:block dark:bg-slate-900">
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
        </>
      )}

      <SectionHeader title="Sinyal risiko" hint="Aturan transparan — bukan ranking" />
      <div className="mt-4">
        <AlertControls cohortId={data.active.id} alerts={data.alerts} />
      </div>

      <SectionHeader title="Kelola kelas" hint="Alat kerja guru" />
      <nav aria-label="Alat guru" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            href: "/teacher/grading",
            title: "Antrian penilaian",
            desc: "Nilai jawaban esai & tugas manual",
          },
          {
            href: "/teacher/questions",
            title: "Bank soal",
            desc: "Buat soal berversi + kunci jawaban",
          },
          {
            href: "/teacher/cohorts",
            title: "Cohort & enrollment",
            desc: "Kelola kelas dan pendaftaran murid",
          },
          {
            href: "/teacher/analytics",
            title: "Analitik kelas",
            desc: "Butir soal, miskonsepsi, hambatan",
          },
          {
            href: "/teacher/certificates",
            title: "Sertifikat & anchoring",
            desc: "Terbitkan, reissue, dan anchor batch",
          },
          // Tautan admin hanya bila adminCtx (guru pemilik course) — bukan semua guru.
          ...((adminCtx && [
            {
              href: "/teacher/admin/map",
              title: "Admin: mapping",
              desc: "Petakan murid & guru ke kelas/subjek",
            },
          ]) ||
            []),
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:bg-slate-900"
          >
            <p className="font-bold text-blue-700 group-hover:underline dark:text-blue-300">{a.title}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.desc}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
