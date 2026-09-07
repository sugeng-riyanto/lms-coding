import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/lib/role-nav";
import { FontScaleControl } from "./font-scale";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["student"]);
  return (
    <AppShell
      eyebrow="Area Belajar Murid"
      nav={navForRole("student", false)}
      topbarExtra={<FontScaleControl />}
    >
      {children}
    </AppShell>
  );
}
