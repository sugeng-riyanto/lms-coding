import { requireActiveMembership } from "@/lib/auth/guards";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function GuardianLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["guardian"]);
  return <>{children}</>;
}
