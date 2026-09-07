/**
 * Template XLSX bulk: single source of truth untuk header + contoh baris.
 *
 * KONTRAK: setiap header di bawah WAJIB ada di daftar alias parser
 * (`lib/bulk-import.ts`) — dibuktikan `tests/integration/bulk-contract.test.ts`
 * yang mem-parse ulang contoh baris dan menuntut 0 error. Ubah header di sini
 * = ubah parser + template + ekspor sekaligus (satu sumber).
 */

export type BulkTemplateKind = "students" | "content" | "teachers" | "assignments";

export interface BulkTemplateDef {
  kind: BulkTemplateKind;
  sheet: string;
  fileName: string;
  headers: string[];
  /** Contoh baris yang HARUS lolos parser tanpa error (bukti kontrak). */
  sample: string[][];
  /** Kapasitas baris valid per file (mirror MAX_*_ROWS). */
  capacity: number;
}

export const BULK_TEMPLATES: Record<BulkTemplateKind, BulkTemplateDef> = {
  students: {
    kind: "students",
    sheet: "Murid",
    fileName: "template-murid.xlsx",
    headers: ["Email", "Nama"],
    sample: [
      ["murid01@demo.local", "Murid 01"],
      ["murid02@demo.local", "Murid 02"],
    ],
    capacity: 500,
  },
  content: {
    kind: "content",
    sheet: "Materi",
    fileName: "template-materi.xlsx",
    headers: ["Module", "Lesson", "Objective", "Activity Type", "Activity Title", "Content JSON"],
    sample: [
      [
        "Modul 1",
        "Pelajaran 1",
        "Memahami konsep dasar",
        "article",
        "Bacaan pembuka",
        '{"body":"Isi bacaan..."}',
      ],
      ["Modul 1", "Pelajaran 1", "", "quiz", "Kuis 1", ""],
    ],
    capacity: 1000,
  },
  teachers: {
    kind: "teachers",
    sheet: "Guru",
    fileName: "template-guru.xlsx",
    headers: ["Email", "Nama", "Kelas"],
    sample: [["guru2@sekolah.id", "Guru Dua", "Kelas 7A; Kelas 7B"]],
    capacity: 200,
  },
  assignments: {
    kind: "assignments",
    sheet: "Penugasan",
    fileName: "template-penugasan.xlsx",
    headers: ["Email", "Kelas", "Subjek"],
    sample: [["murid01@demo.local", "Kelas 7A", "Matematika Dasar"]],
    capacity: 1000,
  },
};

export const BULK_TEMPLATE_KINDS = Object.keys(BULK_TEMPLATES) as BulkTemplateKind[];

/** Escape anti formula-injection untuk sel XLSX (mirror lib/csv). */
export function escapeXlsxCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
