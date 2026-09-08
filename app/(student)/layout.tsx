import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/lib/role-nav";
import { EYEBROW, getLang, pick } from "@/lib/i18n";
import { FontScaleControl } from "./font-scale";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["student"]);
  const lang = await getLang();
  return (
    <AppShell
      eyebrow={pick(EYEBROW.student, lang)}
      nav={navForRole("student", false, lang)}
      topbarExtra={<FontScaleControl lang={lang} />}
    >
      {children}
    </AppShell>
  );
}
