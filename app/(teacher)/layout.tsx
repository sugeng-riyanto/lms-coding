import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/lib/role-nav";
import { getOrgAdminContext } from "@/lib/org-admin";
import { EYEBROW, getLang, pick } from "@/lib/i18n";
import { NotificationBell } from "@/components/notification-bell";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["teacher"]);
  const adminCtx = await getOrgAdminContext();
  const lang = await getLang();
  return (
    <AppShell
      eyebrow={pick(EYEBROW.teacher, lang)}
      nav={navForRole("teacher", adminCtx !== null, lang)}
      topbarExtra={<NotificationBell lang={lang} />}
    >
      {children}
    </AppShell>
  );
}
