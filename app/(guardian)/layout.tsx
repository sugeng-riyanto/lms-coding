import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/lib/role-nav";
import { EYEBROW, getLang, pick } from "@/lib/i18n";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function GuardianLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["guardian"]);
  const lang = await getLang();
  return (
    <AppShell eyebrow={pick(EYEBROW.guardian, lang)} nav={navForRole("guardian", false, lang)}>
      {children}
    </AppShell>
  );
}
