import type { TextDict } from "@/lib/i18n";

/** Admin mapping: `/teacher/admin/map` page + MappingPanel + Teacher/AssignmentBulkImport. */
export const ADMIN_MAP = {
  // Page shell
  denied: {
    id: "Halaman admin hanya untuk guru yang memiliki course di organisasi ini (facet Owner, ADR-008).",
    en: "This admin page is for teachers who own a course in this organization (Owner facet, ADR-008).",
  },
  backToDashboard: { id: "Kembali ke dashboard", en: "Back to dashboard" },
  loadFailed: { id: "Data admin tidak dapat dimuat.", en: "Admin data could not be loaded." },
  title: { id: "Admin — mapping kelas & subjek", en: "Admin — class & subject mapping" },
  subtitle: {
    id: "Kelola guru, murid, dan penugasannya ke kelas (cohort) dan subjek (course). Import identitas via XLSX, lalu rapikan mapping secara manual di panel bawah.",
    en: "Manage teachers, students, and their assignments to classes (cohorts) and subjects (courses). Import identities via XLSX, then fine-tune the mapping manually in the panels below.",
  },

  // MappingPanel — student
  studentAria: { id: "Mapping murid", en: "Student mapping" },
  studentTitle: { id: "Mapping murid → kelas & subjek", en: "Map student → classes & subjects" },
  studentLabel: { id: "Murid", en: "Student" },
  selectStudent: { id: "— pilih murid —", en: "— select student —" },
  classesLabel: { id: "Kelas (cohort)", en: "Classes (cohort)" },
  noClasses: { id: "Belum ada kelas.", en: "No classes yet." },
  subjectsLabel: { id: "Subjek (course)", en: "Subjects (course)" },
  noSubjects: { id: "Belum ada subjek.", en: "No subjects yet." },
  saving: { id: "Menyimpan…", en: "Saving…" },
  saveStudent: { id: "Simpan mapping murid", en: "Save student mapping" },
  studentHint: {
    id: "Subjek di-enroll di setiap kelas yang dipilih (grid kelas × subjek).",
    en: "Subjects are enrolled in every selected class (class × subject grid).",
  },
  pickStudentFirst: { id: "Pilih murid dulu.", en: "Pick a student first." },
  savedSummary: {
    id: "{members} keanggotaan kelas · {enrollments} enrollment subjek.",
    en: "{members} class memberships · {enrollments} subject enrollments.",
  },
  ignoredInvalid: { id: "{count} id tak valid diabaikan.", en: "{count} invalid ids ignored." },

  // MappingPanel — teacher
  teacherAria: { id: "Mapping guru", en: "Teacher mapping" },
  teacherTitle: { id: "Guru pengampu kelas", en: "Class teacher" },
  teacherLabel: { id: "Guru", en: "Teacher" },
  selectTeacher: { id: "— pilih guru —", en: "— select teacher —" },
  classLabel: { id: "Kelas", en: "Class" },
  selectClass: { id: "— pilih kelas —", en: "— select class —" },
  assignTeacher: { id: "Tetapkan guru ke kelas", en: "Assign teacher to class" },
  teacherHint: {
    id: "Menetapkan guru akan memindahkan kelas ke pengampu baru.",
    en: "Assigning a teacher moves the class to the new teacher.",
  },
  pickTeacherFirst: { id: "Pilih guru dan kelas dulu.", en: "Pick a teacher and a class first." },
  teacherAssigned: { id: "Guru pengampu kelas diperbarui.", en: "Class teacher updated." },

  failPrefix: { id: "Gagal: {error}", en: "Failed: {error}" },

  // Error codes
  errInvalidInput: { id: "Data tidak valid.", en: "Invalid data." },
  errForbidden: {
    id: "Aksi ini hanya untuk admin org (guru pemilik course).",
    en: "This action is for org admins only (teachers who own a course).",
  },
  errStudentNotFound: {
    id: "Murid tidak ditemukan di organisasi ini.",
    en: "Student not found in this organization.",
  },
  errTeacherNotFound: {
    id: "Guru tidak ditemukan sebagai guru aktif di org ini.",
    en: "Teacher not found as an active teacher in this org.",
  },
  errClassNotFound: { id: "Kelas tidak ditemukan di org ini.", en: "Class not found in this org." },
  errUpdateFailed: { id: "Gagal memperbarui kelas.", en: "Failed to update class." },

  // TeacherBulkImport
  teacherBulkTitle: { id: "Bulk daftarkan guru (XLSX)", en: "Bulk register teachers (XLSX)" },
  teacherBulkDesc: {
    id: "Kolom: Email, Nama, opsional Kelas (pisah dengan ; atau , — kelas akan dibuat bila belum ada). Akun harus sudah ada; hanya peran guru yang dibuat.",
    en: "Columns: Email, Name, optional Class (separate with ; or , — classes are created if missing). Accounts must already exist; only the teacher role is created.",
  },
  teacherBulkTemplate: { id: "Template guru", en: "Teacher template" },
  teacherBulkCapacity: { id: "Maksimal {max} guru per file", en: "Up to {max} teachers per file" },
  uploadTeacher: { id: "Upload guru", en: "Upload teachers" },
  fileLabel: { id: "Berkas XLSX", en: "XLSX file" },
  processing: { id: "Memproses…", en: "Processing…" },
  teachersProcessed: { id: "{count} guru diproses", en: "{count} teachers processed" },
  classesCreated: { id: "{count} kelas baru dibuat", en: "{count} classes created" },
  emailsNotFound: { id: "{count} email tidak ditemukan", en: "{count} emails not found" },
  notFoundList: { id: "Tidak ditemukan: {list}", en: "Not found: {list}" },

  // AssignmentBulkImport
  assignBulkTitle: {
    id: "Bulk penugasan murid → kelas & subjek (XLSX)",
    en: "Bulk assignment of students → classes & subjects (XLSX)",
  },
  assignBulkDesc: {
    id: "Kolom: Email, Kelas (opsional), Subjek (opsional) — minimal satu per baris. Murid dimasukkan ke kelas (cohort) dan di-enroll ke subjek (course) di organisasi ini.",
    en: "Columns: Email, Class (optional), Subject (optional) — at least one per row. Students are placed into the class (cohort) and enrolled in the subject (course) in this organization.",
  },
  assignBulkTemplate: { id: "Template penugasan", en: "Assignment template" },
  assignBulkCapacity: { id: "Maksimal {max} baris per file", en: "Up to {max} rows per file" },
  uploadAssignment: { id: "Upload penugasan", en: "Upload assignments" },
  assignmentsProcessed: { id: "{count} penugasan diproses", en: "{count} assignments processed" },
  unknownClasses: { id: "{count} kelas tak dikenal", en: "{count} unknown classes" },
  unknownSubjects: { id: "{count} subjek tak dikenal", en: "{count} unknown subjects" },
  classList: { id: "Kelas: {list}", en: "Classes: {list}" },
  subjectList: { id: "Subjek: {list}", en: "Subjects: {list}" },

  // Shared bulk errors
  bulkErrMustBeXlsx: { id: "Berkas harus berformat .xlsx.", en: "File must be .xlsx." },
  bulkErrEmpty: { id: "Berkas kosong.", en: "File is empty." },
  bulkErrTooLarge: { id: "Berkas terlalu besar (maks 5 MB).", en: "File is too large (max 5 MB)." },
  bulkErrMime: { id: "Tipe berkas ditolak.", en: "File type rejected." },
  bulkErrNoValidRows: { id: "Tidak ada baris valid di berkas.", en: "No valid rows in the file." },
  bulkErrRowsOverCap: { id: "Terlalu banyak baris.", en: "Too many rows." },
  bulkErrMissing: { id: "Berkas tidak ditemukan.", en: "File not found." },
} as const satisfies TextDict;
