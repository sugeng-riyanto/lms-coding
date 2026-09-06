import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
      <p className="text-sm font-semibold text-blue-700">Halo, Wali 👋</p>
      <h1 className="mt-1 text-3xl font-bold">Ringkasan anak</h1>
      <p className="mt-2 text-sm text-slate-600">
        Ringkasan hanya untuk anak yang tertaut ke Anda melalui <em>guardian link</em> aktif, dan hanya berisi
        data yang diizinkan RLS (profil, enrollment, progress — bukan jawaban/nilai detail).
      </p>

      {children.length === 0 ? (
        <p className="mt-6 rounded-xl border p-5" role="status">
          Belum ada anak tertaut. Minta pihak sekolah menautkan akun Anda sebagai wali (guardian link aktif) —
          misalnya ke bagian{" "}
          <Link href="/profile" className="text-blue-700 underline">
            profil
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {children.map((c) => {
            const last = daysAgo(c.lastActivityAt);
            return (
              <li
                key={c.studentId}
                aria-label={`Ringkasan ${c.displayName}`}
                className="rounded-xl border p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-800"
                    >
                      {c.displayName.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold">{c.displayName}</p>
                      <p className="text-xs text-slate-500">
                        Tertaut sejak {c.linkedSinceIso ? formatJakarta(c.linkedSinceIso) : "—"}
                      </p>
                    </div>
                  </div>
                  <span
                    aria-label={`Status ${c.displayName}`}
                    className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800"
                  >
                    Tertaut aktif
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Enrollment aktif</dt>
                    <dd className="mt-1 text-xl font-bold">{c.activeEnrollments}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Progress</dt>
                    <dd className="mt-1 text-xl font-bold">{c.levelTotal > 0 ? `${c.progressPct}%` : "—"}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Mastery rata-rata</dt>
                    <dd className="mt-1 text-xl font-bold">{c.levelTotal > 0 ? `${c.masteryPct}%` : "—"}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Terakhir aktif</dt>
                    <dd className="mt-1 text-xl font-bold">
                      {last === null ? "—" : last === 0 ? "Hari ini" : `${last} hari lalu`}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-xs text-slate-500">
                  Level tuntas {c.levelCompleted} dari {c.levelTotal || 0} pada enrollment aktif.
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
