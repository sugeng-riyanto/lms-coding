import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProgressRing } from "@/components/dashboard";
import { formatJakarta } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Dashboard Wali — kapabilitas `view_linked_child_summary` (RBAC.md):
 * ringkasan anak TERTAUT-AKTIF saja. Semua baca dibatasi RLS ke tabel yang
 * punya policy guardian (profiles/enrollments/progress_snapshots via active
 * guardian_links) — tidak menyentuh attempts/jawaban/kunci.
 */
interface ChildSummary {
  studentId: string;
  displayName: string;
  linkedSinceIso: string | null;
  activeEnrollments: number;
  levelTotal: number;
  levelCompleted: number;
  progressPct: number;
  masteryPct: number;
  lastActivityAt: string | null;
}

async function getChildren(userId: string): Promise<ChildSummary[]> {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("guardian_links")
    .select("student_id, consent_at, created_at")
    .eq("guardian_id", userId)
    .eq("status", "active");
  const list =
    (links as { student_id: string; consent_at: string | null; created_at: string }[] | null) ?? [];

  const children: ChildSummary[] = [];
  for (const link of list) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", link.student_id)
      .single();
    const displayName =
      (profile as { display_name: string } | null)?.display_name ?? link.student_id.slice(0, 8);

    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", link.student_id)
      .eq("status", "active");
    const enrollmentIds = ((enrollments as { id: string }[] | null) ?? []).map((e) => e.id);

    let levelTotal = 0;
    let levelCompleted = 0;
    let progressPct = 0;
    let masteryPct = 0;
    let lastActivityAt: string | null = null;
    if (enrollmentIds.length > 0) {
      const { data: snaps } = await supabase
        .from("progress_snapshots")
        .select("status, percent, mastery, last_activity_at")
        .in("enrollment_id", enrollmentIds)
        .eq("entity_type", "level");
      const rows =
        (snaps as
          { status: string; percent: number; mastery: number; last_activity_at: string | null }[] | null) ??
        [];
      levelTotal = rows.length;
      levelCompleted = rows.filter((s) => s.status === "completed").length;
      if (rows.length > 0) {
        progressPct = Math.round(rows.reduce((a, s) => a + Number(s.percent), 0) / rows.length);
        masteryPct = Math.round((rows.reduce((a, s) => a + Number(s.mastery), 0) / rows.length) * 100);
        lastActivityAt =
          rows
            .map((s) => s.last_activity_at)
            .filter((v): v is string => Boolean(v))
            .sort()
            .pop() ?? null;
      }
    }

    children.push({
      studentId: link.student_id,
      displayName,
      linkedSinceIso: link.consent_at ?? link.created_at,
      activeEnrollments: enrollmentIds.length,
      levelTotal,
      levelCompleted,
      progressPct,
      masteryPct,
      lastActivityAt,
    });
  }
  return children.sort((a, b) => a.displayName.localeCompare(b.displayName, "id"));
}

function daysAgo(isoUtc: string | null): number | null {
  if (!isoUtc) return null;
  return Math.max(0, Math.round((Date.now() - Date.parse(isoUtc)) / 86400000));
}

export default async function GuardianPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  let children: ChildSummary[] = [];
  if (userId) {
    try {
      children = await getChildren(userId);
    } catch {
      children = [];
    }
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-700">Portal Orang Tua / Wali</p>
          <h1 className="mt-1 text-3xl font-bold">Ringkasan Perkembangan Anak</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Ringkasan hanya menampilkan anak yang tertaut melalui <em>guardian link</em> aktif dan data yang
        diizinkan kebijakan akses (profil, pendaftaran, progres — bukan jawaban atau nilai terperinci).
      </p>

      {children.length === 0 ? (
        <p className="mt-6 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900" role="status">
          Belum ada anak tertaut. Minta pihak sekolah menautkan akun Anda sebagai wali (guardian link aktif) —
          misalnya ke bagian{" "}
          <Link href="/profile" className="text-blue-700 underline dark:text-blue-300">
            profil
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 space-y-5">
          {children.map((c) => {
            const last = daysAgo(c.lastActivityAt);
            const hasProgress = c.levelTotal > 0;
            return (
              <li
                key={c.studentId}
                aria-label={`Ringkasan ${c.displayName}`}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-700 to-blue-900 p-5 text-white dark:from-blue-900 dark:to-slate-900">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-xl font-extrabold"
                    >
                      {c.displayName.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-lg font-extrabold">{c.displayName}</p>
                      <p className="text-xs text-blue-100">
                        Tertaut sejak {c.linkedSinceIso ? formatJakarta(c.linkedSinceIso) : "—"}
                      </p>
                    </div>
                  </div>
                  <span
                    aria-label={`Status ${c.displayName}`}
                    className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold"
                  >
                    Tertaut aktif
                  </span>
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-3">
                  <div className="flex items-center justify-center">
                    <ProgressRing pct={c.progressPct} label={`Progress belajar ${c.displayName}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:col-span-2">
                    <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-2xl font-extrabold">{c.activeEnrollments}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Enrollment aktif</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-2xl font-extrabold">{hasProgress ? `${c.masteryPct}%` : "—"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Mastery rata-rata</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-2xl font-extrabold">
                        {last === null ? "—" : last === 0 ? "Hari ini" : `${last} hari`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Terakhir aktif</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-2xl font-extrabold">
                        {hasProgress ? `${c.levelCompleted}/${c.levelTotal}` : "—"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Level tuntas</p>
                    </div>
                  </div>
                </div>

                <p className="border-t px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {hasProgress
                    ? `Level tuntas ${c.levelCompleted} dari ${c.levelTotal} pada enrollment aktif.`
                    : "Belum ada progres tercatat — data muncul setelah anak mulai belajar."}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
