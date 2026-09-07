import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/lib/role-nav";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function GuardianLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["guardian"]);
  return (
    <AppShell eyebrow="Portal Wali" nav={navForRole("guardian", false)}>
      {children}
    </AppShell>
  );
}
