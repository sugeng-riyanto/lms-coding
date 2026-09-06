import { requireActiveMembership } from "@/lib/auth/guards";
import { FontScaleControl } from "./font-scale";
import { ThemeToggle } from "@/components/theme-toggle";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["student"]);
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <p className="text-sm font-semibold text-slate-600">Area Belajar Murid</p>
          <div className="flex items-center gap-2">
            <FontScaleControl />
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
