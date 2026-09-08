import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProgressRing } from "@/components/dashboard";
import { formatJakarta } from "@/lib/time";
import { fmt, getLang, mkT } from "@/lib/i18n";
import { GUARDIAN } from "@/lib/ui-text/guardian";

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
  certificates: {
    publicId: string;
    serial: string;
    status: string;
    issuedAt: string;
    level: string;
  }[];
}

async function getChildCertificates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollmentIds: string[],
): Promise<ChildSummary["certificates"]> {
  if (enrollmentIds.length === 0) return [];
  const { data: certs } = await supabase
    .from("certificates")
    .select("public_id,serial_no,status,issued_at,level_id")
    .in("enrollment_id", enrollmentIds)
    .order("issued_at", { ascending: false });
  const out: ChildSummary["certificates"] = [];
  for (const c of (certs as
    { public_id: string; serial_no: string; status: string; issued_at: string; level_id: string }[] | null) ??
    []) {
    const { data: lv } = await supabase.from("levels").select("title").eq("id", c.level_id).single();
    out.push({
      publicId: c.public_id,
      serial: c.serial_no,
      status: c.status,
      issuedAt: c.issued_at,
      level: (lv as { title: string } | null)?.title ?? "—",
    });
  }
  return out;
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
      certificates: await getChildCertificates(supabase, enrollmentIds),
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
  const lang = await getLang();
  const t = mkT(GUARDIAN, lang);
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
          <p className="text-sm font-semibold text-blue-700">{t("eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-bold">{t("title")}</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{fmt(t("intro"), {})}</p>

      {children.length === 0 ? (
        <p className="mt-6 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900" role="status">
          {t("noChildrenBefore")}{" "}
          <Link href="/profile" className="text-blue-700 underline dark:text-blue-300">
            {t("profileLink")}
          </Link>
          {t("noChildrenAfter")}
        </p>
      ) : (
        <ul className="mt-6 space-y-5">
          {children.map((c) => {
            const last = daysAgo(c.lastActivityAt);
            const hasProgress = c.levelTotal > 0;
            return (
              <li
                key={c.studentId}
                aria-label={fmt(t("summaryAria"), { name: c.displayName })}
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
                        {c.linkedSinceIso
                          ? fmt(t("linkedSince"), { date: formatJakarta(c.linkedSinceIso) })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <span
                    aria-label={fmt(t("statusAria"), { name: c.displayName })}
                    className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold"
                  >
                    {t("linkedActive")}
                  </span>
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-3">
                  <div className="flex items-center justify-center">
                    <ProgressRing
                      pct={c.progressPct}
                      label={fmt(t("progressAria"), { name: c.displayName })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:col-span-2">
                    <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-2xl font-extrabold">{c.activeEnrollments}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t("activeEnrollments")}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-2xl font-extrabold">{hasProgress ? `${c.masteryPct}%` : "—"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t("avgMastery")}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-2xl font-extrabold">
                        {last === null ? "—" : last === 0 ? t("today") : fmt(t("daysAgo"), { n: last })}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t("lastActive")}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-2xl font-extrabold">
                        {hasProgress ? `${c.levelCompleted}/${c.levelTotal}` : "—"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t("levelsCompleted")}</p>
                    </div>
                  </div>
                </div>

                <p className="border-t px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {hasProgress
                    ? fmt(t("progressFootnote"), { done: c.levelCompleted, total: c.levelTotal })
                    : t("noProgress")}
                </p>

                <div className="border-t px-5 py-4">
                  <p className="text-sm font-bold">{t("certAuto")}</p>
                  {c.certificates.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400" role="status">
                      {t("noCerts")}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {c.certificates.map((cert) => (
                        <li key={cert.publicId} className="rounded-xl border p-3 dark:bg-slate-900">
                          <p className="font-semibold">{cert.level}</p>
                          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {cert.serial} · {cert.status} · {formatJakarta(cert.issuedAt)}
                          </p>
                          {cert.status === "active" ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <a
                                href={`/api/certificates/${cert.publicId}/pdf`}
                                className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--glow-btn)]"
                              >
                                {t("downloadPdf")}
                              </a>
                              <Link
                                href={`/verify/${cert.publicId}`}
                                className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                              >
                                {t("verify")}
                              </Link>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-red-700 dark:text-red-300">{t("revokedNote")}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
