import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/lib/role-nav";
import { getOrgAdminContext } from "@/lib/org-admin";
import { EYEBROW, getLang, pick } from "@/lib/i18n";
import { Messaging } from "@/components/messaging";
import { createClient } from "@/lib/supabase/server";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["teacher"]);
  const adminCtx = await getOrgAdminContext();
  const lang = await getLang();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | undefined)?.sub ?? "";
  return (
    <AppShell
      eyebrow={pick(EYEBROW.teacher, lang)}
      nav={navForRole("teacher", adminCtx !== null, lang)}
      topbarExtra={
        <div className="flex items-center gap-1">
          <Messaging lang={lang} userId={userId} role="teacher" />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
