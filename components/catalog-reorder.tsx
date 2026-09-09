"use client";

/**
 * Urutan kartu katalog yang bisa disusun ulang (RBAC-scoped, persisten).
 *
 * - Sortir A→Z / Z→A berdasarkan `sortValue` (mis. judul course).
 * - Movable: drag & drop (desktop) ATAU tombol ▲/▼ (aksesibilitas + layar kecil).
 * - Setiap perubahan urutan langsung disimpan via server action `saveCatalogOrder`
 *   (scope student_catalog / teacher_courses; validasi himpunan id server-side).
 * - Kartu yang belum ada di urutan tersimpan (kursus baru) otomatis ditaruh di akhir.
 *
 * Hanya preferensi render pribadi — bukan data otoritatif.
 */
import { useMemo, useState } from "react";
import { saveCatalogOrder } from "@/features/actions";

export interface CatalogOrderItem {
  id: string;
  /** Nilai untuk sortir A→Z / Z→A (mis. judul course). */
  sortValue: string;
  node: React.ReactNode;
}

export interface CatalogOrderLabels {
  sortAsc: string;
  sortDesc: string;
  dragHint: string;
  moveUp: string; // template dengan {title}
  moveDown: string; // template dengan {title}
  saving: string;
  saved: string;
  saveFailed: string;
}

export type CatalogOrderScope = "student_catalog" | "teacher_courses";

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

export function CatalogReorder({
  items,
  labels,
  scope,
  initialOrder,
}: {
  items: CatalogOrderItem[];
  labels: CatalogOrderLabels;
  scope: CatalogOrderScope;
  /** Urutan tersimpan dari server; undefined = urutan default items. */
  initialOrder?: string[] | null;
}) {
  const itemIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const [orderIds, setOrderIds] = useState<string[]>(() => {
    const base = (initialOrder ?? []).filter((id) => itemIds.has(id));
    const seen = new Set(base);
    for (const i of items) if (!seen.has(i.id)) base.push(i.id);
    return base;
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function persist(next: string[]) {
    setStatus("saving");
    const res = await saveCatalogOrder({ scope, orderedIds: next });
    setStatus(res.ok ? "saved" : "error");
    if (!res.ok) window.setTimeout(() => setStatus("idle"), 3000);
  }

  function sort(dir: "asc" | "desc") {
    const sorted = [...orderIds].sort((a, b) => {
      const va = byId.get(a)?.sortValue ?? "";
      const vb = byId.get(b)?.sortValue ?? "";
      const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" });
      return dir === "asc" ? cmp : -cmp;
    });
    setOrderIds(sorted);
    void persist(sorted);
  }

  function move(id: string, dir: -1 | 1) {
    const idx = orderIds.indexOf(id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= orderIds.length) return;
    const next = [...orderIds];
    const a = next[idx];
    const b = next[j];
    if (a === undefined || b === undefined) return;
    next[idx] = b;
    next[j] = a;
    setOrderIds(next);
    void persist(next);
  }

  function onDropOnto(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = orderIds.filter((id) => id !== dragId);
    const targetIdx = next.indexOf(targetId);
    if (targetIdx < 0) return;
    next.splice(targetIdx, 0, dragId);
    setOrderIds(next);
    setDragId(null);
    void persist(next);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={labels.dragHint}>
        <button
          onClick={() => sort("asc")}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:hover:border-blue-500 dark:hover:bg-blue-950/40"
        >
          {labels.sortAsc}
        </button>
        <button
          onClick={() => sort("desc")}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:hover:border-blue-500 dark:hover:bg-blue-950/40"
        >
          {labels.sortDesc}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">{labels.dragHint}</span>
        {status === "saving" && (
          <span role="status" className="text-xs text-slate-500">
            {labels.saving}
          </span>
        )}
        {status === "saved" && (
          <span role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {labels.saved}
          </span>
        )}
        {status === "error" && (
          <span role="alert" className="text-xs font-semibold text-red-700 dark:text-red-300">
            {labels.saveFailed}
          </span>
        )}
      </div>
      <ol className="mt-3 space-y-4">
        {orderIds.map((id) => {
          const item = byId.get(id);
          if (!item) return null;
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragId(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropOnto(id)}
              className="group relative"
            >
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border bg-white/90 px-1.5 py-1 opacity-0 shadow-sm transition group-hover:opacity-100 dark:bg-slate-800/90 print:hidden">
                <span aria-hidden="true" className="cursor-grab px-1 text-slate-400 active:cursor-grabbing">
                  ⠿
                </span>
                <button
                  onClick={() => move(id, -1)}
                  aria-label={fill(labels.moveUp, { title: item.sortValue })}
                  className="rounded px-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-300"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(id, 1)}
                  aria-label={fill(labels.moveDown, { title: item.sortValue })}
                  className="rounded px-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-300"
                >
                  ▼
                </button>
              </div>
              {item.node}
            </li>
          );
        })}
      </ol>
    </div>
  );
}