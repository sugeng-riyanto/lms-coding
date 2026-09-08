import type { TextDict } from "@/lib/i18n";

/** Shared BulkCard shell (used by student/teacher/assignment/content bulk imports). */
export const BULK = {
  defaultExportLabel: { id: "Unduh data (XLSX)", en: "Download data (XLSX)" },
  footnote: {
    id: "Berkas hanya dibaca di memori server saat impor — tidak disimpan di mana pun dan langsung dibuang setelah selesai; formulir dikosongkan otomatis bila berhasil.",
    en: "Files are read only in server memory during import — never stored anywhere and discarded as soon as it finishes; the form resets automatically on success.",
  },
} as const satisfies TextDict;
