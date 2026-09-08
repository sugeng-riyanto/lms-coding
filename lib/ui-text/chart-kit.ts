import type { TextDict } from "@/lib/i18n";

/** Dictionary internal komponen grafik (caption, tooltip, label pembaruan). */
export const CHART_TEXT = {
  updated: { id: "Diperbarui: {at}.", en: "Updated: {at}." },
  noData: { id: "{label}: belum ada data", en: "{label}: no data yet" },
  valuePerCategory: { id: "Nilai per kategori: {values}", en: "Values per category: {values}" },
} as const satisfies TextDict;

/** State labels for the dashboard badge, per state key. */
export const STATE_TEXT = {
  locked: { id: "Terkunci", en: "Locked" },
  available: { id: "Tersedia", en: "Available" },
  in_progress: { id: "Dikerjakan", en: "In progress" },
  completed: { id: "Selesai", en: "Completed" },
} as const satisfies TextDict;
