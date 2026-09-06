import { createClient } from "@/lib/supabase/server";
import { isChainEnabled } from "@/lib/chain";
import { AnchorStatusChip } from "@/components/anchor-status";
import { AnchorBatchButton } from "./anchor-batch-button";

export const dynamic = "force-dynamic";

interface CertRow {
  id: string;
  serial_no: string;
  status: string;
  issued_at: string;
  enrollment_id: string;
  enrollments: { student_id: string; profiles: { display_name: string } | null } | null;
  chain_anchors: { status: string | null; transaction_ref: string | null; network: string | null } | null;
}

async function loadCerts(userId: string): Promise<{ certs: CertRow[]; empty: boolean }> {
  const supabase = await createClient();
  const { data: cohortRows } = await supabase.from("cohorts").select("id").eq("teacher_id", userId);
  const cohortIds = ((cohortRows as { id: string }[] | null) ?? []).map((c) => c.id);
  if (cohortIds.length === 0) return { certs: [], empty: true };
  const { data: rows } = await supabase
    .from("certificates")
    .select(
      "id,serial_no,status,issued_at,enrollment_id,enrollments(student_id,profiles(display_name)),chain_anchors(status,transaction_ref,network)",
    )
    .in("enrollments.cohort_id", cohortIds)
    .order("issued_at", { ascending: false })
    .limit(200);
  const certs = ((rows as CertRow[] | null) ?? []).filter(
    (c) => c.enrollments && c.enrollments.profiles,
  ) as CertRow[];
  return { certs, empty: certs.length === 0 };
}

export default async function CertificatesPage() {
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
          <h1 className="text-2xl font-bold">Sertifikat &amp; anchoring</h1>
          <p className="mt-1 text-sm text-slate-500">
            {certs.length} sertifikat ({activeCount} active) · {pendingCount} anchor pending
          </p>
        </div>
      </div>

      <section aria-label="Anchor batch" className="mt-4 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">Anchoring blockchain (opsional)</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Batch payload hash sertifikat menjadi satu Merkle root lalu anchor via adapter (ADR-018). Hanya
          hash/root + transaksi yang disimpan — tanpa data pribadi.
        </p>
        {chainEnabled ? (
          <AnchorBatchButton enabled />
        ) : (
          <p className="mt-2 text-sm text-slate-500" role="status">
            Anchoring nonaktif (BLOCKCHAIN_ANCHOR_ENABLED=false). Aktifkan + set BLOCKCHAIN_PROVIDER=mock
            untuk uji, atau pilih provider nyata setelah ADR-018 diputuskan.
          </p>
        )}
      </section>

      {empty ? (
        <p className="mt-6 rounded-xl border p-5" role="status">
          Belum ada sertifikat di kelas yang Anda ampu.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 font-semibold">Sertifikat</th>
                <th className="px-3 py-2 font-semibold">Murid</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Terbit</th>
                <th className="px-3 py-2 font-semibold">Blockchain</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-b last:border-0 odd:bg-white dark:odd:bg-slate-900">
                  <td className="px-3 py-2 font-mono text-xs">{c.serial_no}</td>
                  <td className="px-3 py-2">{c.enrollments?.profiles?.display_name ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{c.status}</td>
                  <td className="px-3 py-2">{c.issued_at}</td>
                  <td className="px-3 py-2">
                    <AnchorStatusChip
                      status={c.chain_anchors?.status ?? null}
                      reference={c.chain_anchors?.transaction_ref}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Verifikasi publik: /verify/{"{public_id}"}. Anchor pending belum final dan tidak diklaim
        terverifikasi.
      </p>
    </main>
  );
}
