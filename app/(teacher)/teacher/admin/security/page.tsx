import Link from "next/link";
import { cspAlertState } from "@/lib/csp-alerts";
import { getOrgAdminContext } from "@/lib/org-admin";
import { SecurityMonitor } from "@/components/security-monitor";

export const dynamic = "force-dynamic";

/**
 * Admin — Security & monitoring. Menampilkan state agregat alerting CSP
 * (lib/csp-alerts) langsung dari proses server (tanpa HTTP round-trip;
 * kebijakan sama dengan /api/operator/csp-alerts). Hanya org-admin (facet
 * Owner, ADR-008) — guard sama dengan halaman /teacher/admin/map.
 */
export default async function AdminSecurityPage() {
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

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-slate-500">
        <Link href="/teacher/admin/map" className="text-blue-700 underline">
          ← Admin
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-bold">Admin — Security &amp; monitoring</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Pantau laporan Content-Security-Policy dari browser. Lonjakan (spike) bisa menandakan percobaan
        injection — lihat juga baris log{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">csp-alert</code> dan DEPLOYMENT.md §7.3
        untuk ambang batas serta tindakan.
      </p>
      <div className="mt-6">
        <SecurityMonitor initial={await cspAlertState()} />
      </div>
    </main>
  );
}
