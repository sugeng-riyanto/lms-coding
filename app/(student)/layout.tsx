import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/lib/role-nav";
import { EYEBROW, getLang, pick } from "@/lib/i18n";
import { FontScaleControl } from "./font-scale";
import { Messaging } from "@/components/messaging";
import { createClient } from "@/lib/supabase/server";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["student"]);
  const lang = await getLang();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | undefined)?.sub ?? "";
  return (
    <AppShell
      eyebrow={pick(EYEBROW.student, lang)}
      nav={navForRole("student", false, lang)}
      topbarExtra={
        <div className="flex items-center gap-1">
          <Messaging lang={lang} userId={userId} role="student" />
          <FontScaleControl lang={lang} />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
