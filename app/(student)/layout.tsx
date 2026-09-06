import { requireActiveMembership } from "@/lib/auth/guards";
import { FontScaleControl } from "./font-scale";

// Segmen auth-guarded: guard berjalan per-request, bukan saat prerender.
export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireActiveMembership(["student"]);
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
          <p className="text-sm font-semibold text-slate-600">Ruang belajarmu</p>
          <FontScaleControl />
        </div>
      </header>
      {children}
    </div>
  );
}
