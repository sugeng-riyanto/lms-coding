import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/lib/role-nav";
import { getOrgAdminContext } from "@/lib/org-admin";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["teacher"]);
  const adminCtx = await getOrgAdminContext();
  return (
    <AppShell eyebrow="Dasbor Kelas" nav={navForRole("teacher", adminCtx !== null)}>
      {children}
    </AppShell>
  );
}
