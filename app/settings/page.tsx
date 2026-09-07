import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { navForRole } from "@/lib/role-nav";
import { getOrgAdminContext } from "@/lib/org-admin";
import { FontScaleControl } from "@/app/(student)/font-scale";

export const dynamic = "force-dynamic";

const EYEBROW: Record<string, string> = {
  student: "Area Belajar Murid",
  teacher: "Dasbor Kelas",
  guardian: "Portal Wali",
};

/**
 * Pengaturan milik-sendiri untuk SEMUA peran (RBAC.md: bukan kapabilitas
 * khusus — setiap pengguna terautentikasi mengelola akunnya sendiri).
 * Konten menyesuaikan peran; authz tetap guard membership aktif.
 */
export default async function SettingsPage() {
  const identity = await requireActiveMembership(["student", "teacher", "guardian"]);
  const isAdmin = identity.role === "teacher" ? (await getOrgAdminContext()) !== null : false;
  const nav = navForRole(identity.role, isAdmin);

  return (
    <AppShell eyebrow={EYEBROW[identity.role] ?? "LMS"} nav={nav}>
      <main id="main" className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
          Pengaturan
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Akun & preferensi</h1>
        <div className="mt-6">
          <SettingsPanel>
            {identity.role === "student" && (
              <span className="inline-flex items-center gap-2 text-sm">
                Ukuran teks: <FontScaleControl />
              </span>
            )}
          </SettingsPanel>
        </div>
      </main>
    </AppShell>
  );
}
