import Link from "next/link";
import { LogoutButton } from "@/app/profile/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NavItem } from "@/lib/role-nav";
import { MobileDrawer, NavLinks } from "./app-nav";

/**
 * Shell aplikasi terautentikasi: sidebar (desktop) + topbar + drawer (mobile).
 *
 * Server Component — tidak menambah JS kecuali drawer/toggle yang memang butuh
 * interaksi browser. Halaman di bawahnya TETAP merender landmark main
 * sendiri (skip-link root layout menargetkannya), jadi shell memakai div.
 */
export function AppShell({
  eyebrow,
  nav,
  topbarExtra,
  children,
}: {
  eyebrow: string;
  nav: NavItem[];
  topbarExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:flex">
      <aside
        aria-label={`Navigasi ${eyebrow}`}
        className="hidden w-64 shrink-0 flex-col border-r bg-gradient-to-b from-white to-slate-100/80 md:sticky md:top-0 md:flex md:h-screen dark:from-[var(--surface-grad-from)] dark:to-[var(--surface-grad-to)]"
      >
        <div className="flex items-center gap-2.5 border-b p-4">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white shadow-[var(--glow-btn)]"
          >
            CS
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight">Coding School LMS</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{eyebrow}</p>
          </div>
        </div>
        <nav aria-label={eyebrow} className="flex-1 overflow-y-auto p-3">
          <NavLinks items={nav} />
        </nav>
        <div className="border-t p-3">
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
            <div className="flex items-center gap-2">
              <MobileDrawer eyebrow={eyebrow} items={nav} />
              <p className="text-sm font-semibold text-slate-600 md:hidden dark:text-slate-300">{eyebrow}</p>
            </div>
            <div className="flex items-center gap-2">
              {topbarExtra}
              <ThemeToggle />
              <Link
                href="/settings"
                aria-label="Pengaturan"
                title="Pengaturan"
                className="rounded-lg border px-3 py-1.5 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ⚙
              </Link>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
