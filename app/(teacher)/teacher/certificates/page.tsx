import { createClient } from "@/lib/supabase/server";
import { isChainEnabled } from "@/lib/chain";
import { fmt, getLang, mkT } from "@/lib/i18n";
import { CERT } from "@/lib/ui-text/cert";
import { AnchorStatusChip } from "@/components/anchor-status";
import { AnchorBatchButton } from "./anchor-batch-button";
import { AnchorRefreshButton } from "./anchor-refresh-button";

export const dynamic = "force-dynamic";

interface CertRow {
  id: string;
  serial_no: string;
  status: string;
  issued_at: string;
  enrollment_id: string;
  student_name: string;
  chain_anchors: { status: string | null; transaction_ref: string | null; network: string | null } | null;
}

async function loadCerts(userId: string): Promise<{ certs: CertRow[]; empty: boolean }> {
  const supabase = await createClient();
  const { data: cohortRows } = await supabase.from("cohorts").select("id").eq("teacher_id", userId);
  const cohortIds = ((cohortRows as { id: string }[] | null) ?? []).map((c) => c.id);
  if (cohortIds.length === 0) return { certs: [], empty: true };
  // Catatan (defect terperbaiki): schema mendefinisikan
  // `enrollments.student_id references auth.users(id)` — TIDAK ada FK
  // enrollments→profiles, sehingga embed `enrollments(profiles(...))` tak pernah
  // resolve (PGRST200) dan halaman diam-diam tampil 0. Selesaikan nama murid via
  // query `profiles` terpisah (RLS guru tetap cohort-scoped).
  const { data: rows } = await supabase
    .from("certificates")
    .select(
      "id,serial_no,status,issued_at,enrollment_id,enrollments(student_id),chain_anchors(status,transaction_ref,network)",
    )
    .in("enrollments.cohort_id", cohortIds)
    .order("issued_at", { ascending: false })
    .limit(200);
  const raw =
    (rows as
      | {
          id: string;
          serial_no: string;
          status: string;
          issued_at: string;
          enrollment_id: string;
          enrollments: { student_id: string } | null;
          chain_anchors: {
            status: string | null;
            transaction_ref: string | null;
            network: string | null;
          } | null;
        }[]
      | null) ?? [];
  const studentIds = [...new Set(raw.map((r) => r.enrollments?.student_id).filter(Boolean))] as string[];
  const names: Record<string, string> = {};
  if (studentIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", studentIds);
    for (const p of (profs as { id: string; display_name: string }[] | null) ?? []) {
      names[p.id] = p.display_name;
    }
  }
  const certs: CertRow[] = [];
  for (const c of raw) {
    const sid = c.enrollments?.student_id;
    if (!sid || !names[sid]) continue;
    certs.push({ ...c, student_name: names[sid]! });
  }
  return { certs, empty: certs.length === 0 };
}

export default async function CertificatesPage() {
  const lang = await getLang();
  const t = mkT(CERT, lang);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub ?? "";
  const { certs, empty } = await loadCerts(userId);
  const chainEnabled = isChainEnabled();

  const activeCount = certs.filter((c) => c.status === "active").length;
  const pendingCount = certs.filter((c) => c.chain_anchors?.status === "pending").length;

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fmt(t("summary"), { n: certs.length, active: activeCount, pending: pendingCount })}
          </p>
        </div>
      </div>

      <section aria-label={t("batchAria")} className="mt-4 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">{t("sectionTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("sectionBody")}</p>
        {chainEnabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <AnchorBatchButton enabled lang={lang} />
            <AnchorRefreshButton enabled lang={lang} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500" role="status">
            {t("disabledNote")}
          </p>
        )}
      </section>

      {empty ? (
        <p className="mt-6 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900" role="status">
          {t("empty")}
        </p>
      ) : (
        <>
          {/* Kartu tumpuk di HP: tabel 5 kolom (tanggal ISO + chip anchor)
              tidak muat @360px (gate responsif). Data sama. */}
          <ul className="mt-4 space-y-3 md:hidden">
            {certs.map((c) => (
              <li
                key={c.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2 border-b p-4">
                  <p className="font-mono text-sm font-bold">{c.serial_no}</p>
                  <AnchorStatusChip
                    status={c.chain_anchors?.status ?? null}
                    reference={c.chain_anchors?.transaction_ref}
                    lang={lang}
                  />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 p-4 text-sm">
                  <dt className="text-slate-500">{t("student")}</dt>
                  <dd className="font-semibold">{c.student_name ?? "—"}</dd>
                  <dt className="text-slate-500">{t("status")}</dt>
                  <dd className="font-semibold">{c.status}</dd>
                  <dt className="text-slate-500">{t("issued")}</dt>
                  <dd>{c.issued_at.slice(0, 10)}</dd>
                </dl>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border bg-white shadow-sm md:block dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t("colCert")}</th>
                  <th className="px-3 py-2 font-semibold">{t("student")}</th>
                  <th className="px-3 py-2 font-semibold">{t("status")}</th>
                  <th className="px-3 py-2 font-semibold">{t("issued")}</th>
                  <th className="px-3 py-2 font-semibold">{t("colBlockchain")}</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 odd:bg-white dark:odd:bg-slate-900">
                    <td className="px-3 py-2 font-mono text-xs">{c.serial_no}</td>
                    <td className="px-3 py-2">{c.student_name ?? "—"}</td>
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{c.status}</td>
                    <td className="px-3 py-2">{c.issued_at.slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <AnchorStatusChip
                        status={c.chain_anchors?.status ?? null}
                        reference={c.chain_anchors?.transaction_ref}
                        lang={lang}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="mt-4 text-xs text-slate-500">{fmt(t("verifyFootnote"), { public_id: "{public_id}" })}</p>
    </main>
  );
}
