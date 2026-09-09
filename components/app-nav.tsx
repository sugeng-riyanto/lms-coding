"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogoutButton } from "@/app/profile/logout-button";
import type { NavItem } from "@/lib/role-nav";
import { COMMON, type Lang } from "@/lib/i18n";

/** Group labels for teacher sidebar sections. */
const GROUP_LABELS: Partial<Record<string, { id: string; en: string }>> = {
  _overview: { id: "Ringkasan", en: "Overview" },
  _content: { id: "Konten", en: "Content" },
  _students: { id: "Siswa", en: "Students" },
  _admin: { id: "Admin", en: "Admin" },
};

/** Daftar tautan sidebar dengan status aktif (aria-current) berbasis pathname. */
export function NavLinks({
  items,
  onNavigate,
  lang = "en",
}: {
  items: NavItem[];
  onNavigate?: () => void;
  lang?: "id" | "en";
}) {
  const pathname = usePathname();

  // Group items by their group field, preserving order.
  const groups: { key: string; label: string; items: NavItem[] }[] = [];
  const groupMap = new Map<string, NavItem[]>();
  for (const item of items) {
    const g = item.group ?? "_default";
    let arr = groupMap.get(g);
    if (!arr) {
      const lbl = GROUP_LABELS[g];
      const label = lbl != null ? (lang === "id" ? lbl.id : lbl.en) : "";
      arr = [];
      groups.push({ key: g, label, items: arr });
      groupMap.set(g, arr);
    }
    arr.push(item);
  }

  return (
    <ul className="space-y-3">
      {groups.map((group) => (
        <li key={group.key}>
          {/* Section header — skip for _default and _settings (single items). */}
          {group.label && group.key !== "_default" && group.key !== "_settings" && (
            <p className="mb-1 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={item.desc}
                    className={`block rounded-xl px-4 py-2.5 font-medium transition ${
                      active
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 font-bold text-white shadow-[var(--shadow-soft)]"
                        : "text-slate-700 hover:translate-x-0.5 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/**
 * Drawer navigasi mobile: tombol hamburger di topbar → panel slide-over.
 * Fokus: Escape menutup, klik overlay/tautan menutup, aria-expanded sinkron.
 */
export function MobileDrawer({ eyebrow, items, lang }: { eyebrow: string; items: NavItem[]; lang: Lang }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="app-drawer"
        aria-label={COMMON.openNav[lang]}
        className="rounded-lg border px-3 py-1.5 font-bold md:hidden"
      >
        ☰
      </button>
      {/*
        Portal ke document.body: overlay `fixed` TIDAK boleh jadi anak header
        (header memakai backdrop-blur → jadi containing block fixed → drawer
        runtuh setinggi header ~54px di mobile). Di body, fixed = viewport.
      */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
            <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div
              id="app-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`${lang === "id" ? "Navigasi" : "Navigation"} ${eyebrow}`}
              className="absolute top-0 left-0 flex h-full w-72 max-w-[85vw] flex-col bg-gradient-to-b from-white to-slate-100/90 shadow-[var(--shadow-lift)] dark:from-[var(--surface-grad-from)] dark:to-[var(--surface-grad-to)]"
            >
              <div className="flex items-center justify-between gap-2 border-b p-4">
                <p className="flex items-center gap-2 font-bold">
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-[10px] font-black text-white shadow-[var(--glow-btn)]"
                  >
                    CS
                  </span>
                  {eyebrow}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={COMMON.closeNav[lang]}
                  className="rounded-lg border px-3 py-1.5 font-bold"
                >
                  ✕
                </button>
              </div>
              <nav aria-label={eyebrow} className="flex-1 overflow-y-auto p-4">
                <NavLinks items={items} onNavigate={() => setOpen(false)} lang={lang} />
              </nav>
              <div className="border-t p-4">
                <LogoutButton lang={lang} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
