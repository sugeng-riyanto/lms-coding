import type { TextDict } from "@/lib/i18n";

/** Teacher cohorts & enrollment: `/teacher/cohorts` page + CohortManager + StudentBulkImport. */
export const COHORT = {
  // Page shell
  title: { id: "Cohort & enrollment", en: "Cohorts & enrollment" },
  failPrefix: { id: "Gagal: {error}", en: "Failed: {error}" },
  subtitle: {
    id: "Suspend enrollment menonaktifkan akses murid tanpa menghapus riwayat.",
    en: "Suspending an enrollment disables student access without deleting history.",
  },

  // CohortManager
  createAria: { id: "Buat cohort", en: "Create cohort" },
  nameLabel: { id: "Nama cohort", en: "Cohort name" },
  yearLabel: { id: "Tahun ajaran", en: "Academic year" },
  create: { id: "Buat", en: "Create" },
  createdOk: { id: "Cohort dibuat: {id}.", en: "Cohort created: {id}." },
  fillEnroll: { id: "Isi student ID dan course.", en: "Fill in the student ID and course." },
  enrolled: { id: "Murid di-enroll.", en: "Student enrolled." },
  enrollFailHint: {
    id: "Gagal: {error} (pastikan UUID murid benar)",
    en: "Failed: {error} (make sure the student UUID is correct)",
  },
  confirmSuspend: { id: "Suspend enrollment ini?", en: "Suspend this enrollment?" },
  suspended: { id: "Enrollment di-suspend.", en: "Enrollment suspended." },
  noCohorts: { id: "Belum ada cohort.", en: "No cohorts yet." },
  exportRoster: { id: "Ekspor roster (CSV)", en: "Export roster (CSV)" },
  members: { id: "Anggota ({count})", en: "Members ({count})" },
  enrollmentsTitle: { id: "Enrollments", en: "Enrollments" },
  suspend: { id: "Suspend", en: "Suspend" },
  enrollAria: { id: "Enroll ke {name}", en: "Enroll to {name}" },
  studentIdLabel: { id: "Student ID (UUID)", en: "Student ID (UUID)" },
  courseLabel: { id: "Course", en: "Course" },
  selectPrompt: { id: "— pilih —", en: "— select —" },
  enroll: { id: "Enroll", en: "Enroll" },

  // StudentBulkImport
  bulkTitle: { id: "Bulk daftarkan murid (XLSX)", en: "Bulk register students (XLSX)" },
  bulkDesc: {
    id: "Kolom: Email (wajib) dan Nama (opsional). Murid dicocokkan berdasarkan email akun yang sudah ada; profil & membership dibuat otomatis oleh server.",
    en: "Columns: Email (required) and Name (optional). Students are matched by the email of an existing account; profile & membership are created automatically by the server.",
  },
  bulkTemplateLabel: { id: "Template murid", en: "Student template" },
  bulkExportLabel: { id: "Unduh roster cohort (XLSX)", en: "Download cohort roster (XLSX)" },
  bulkCapacity: { id: "Maksimal {max} murid per file", en: "Up to {max} students per file" },
  targetCohort: { id: "Cohort tujuan", en: "Target cohort" },
  selectCohort: { id: "— pilih cohort —", en: "— select cohort —" },
  fileLabel: { id: "Berkas XLSX", en: "XLSX file" },
  processing: { id: "Memproses…", en: "Processing…" },
  importStudents: { id: "Impor murid", en: "Import students" },
  doneSummary: {
    id: "Selesai: {added} ditambahkan, {existing} sudah menjadi anggota.",
    en: "Done: {added} added, {existing} already members.",
  },
  notFound: {
    id: "Email tidak ditemukan ({count}): {list}",
    en: "Emails not found ({count}): {list}",
  },
  failed: { id: "Gagal: {error}", en: "Failed: {error}" },
  errRowsOverCap: {
    id: "File melebihi batas {cap} baris valid. Pecah menjadi beberapa file.",
    en: "File exceeds the {cap} valid-row limit. Split it into several files.",
  },
  errMustBeXlsx: { id: "Berkas harus berformat .xlsx.", en: "File must be .xlsx." },
  errEmpty: { id: "Berkas kosong (0 byte).", en: "File is empty (0 bytes)." },
  errTooLarge: { id: "Berkas melebihi batas ukuran 5 MB.", en: "File exceeds the 5 MB size limit." },
  errMimeRejected: {
    id: "Jenis berkas tidak dikenali sebagai spreadsheet.",
    en: "File type is not recognized as a spreadsheet.",
  },
} as const satisfies TextDict;
