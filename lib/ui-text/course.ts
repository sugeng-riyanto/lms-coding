import type { TextDict } from "@/lib/i18n";

/** Course create/manage (app/(teacher)/teacher/courses/**) + preview + level page shell. */
export const COURSE: TextDict = {
  // ---- new-course-form ----
  formLabel: { id: "Form course baru", en: "New course form" },
  slugLabel: { id: "Slug (huruf kecil, angka, strip)", en: "Slug (lowercase, digits, dashes)" },
  titleLabel: { id: "Judul", en: "Title" },
  descriptionLabel: { id: "Deskripsi", en: "Description" },
  saving: { id: "Menyimpan…", en: "Saving…" },
  createDraft: { id: "Buat draft", en: "Create draft" },
  draftCreated: {
    id: "Draft dibuat (course {courseId}, versi 1). Tambahkan level via authoring lanjutan, lalu publish.",
    en: "Draft created (course {courseId}, version 1). Add levels via advanced authoring, then publish.",
  },
  onlyActiveTeacher: {
    id: "Hanya guru aktif yang bisa membuat course.",
    en: "Only active teachers can create courses.",
  },
  failedWithError: { id: "Gagal: {error}", en: "Failed: {error}" },

  // ---- new page ----
  newTitle: { id: "Buat course baru", en: "Create a new course" },
  newIntro: {
    id: "Draft tersimpan sebagai versi 1. Konten yang sudah dipakai attempt tidak diedit in-place — publish membuat validasi server-side; perubahan berikutnya membuat versi baru.",
    en: "The draft is stored as version 1. Content already used by attempts is never edited in place — publishing runs server-side validation; later changes create a new version.",
  },

  // ---- course manage page ----
  loadFailed: { id: "Data course tidak dapat dimuat.", en: "Course data could not be loaded." },
  backToDashboard: { id: "← Dashboard guru", en: "← Teacher dashboard" },
  statusColon: { id: "Status: ", en: "Status: " },
  versionLine: {
    id: " · Versi {version} · {state}",
    en: " · Version {version} · {state}",
  },
  publishedAt: { id: "terbit {at}", en: "published {at}" },
  draftNotPublished: { id: "draft (belum terbit)", en: "draft (not published)" },
  noVersion: { id: " · tanpa versi", en: " · no version" },
  noVersionMsg: { id: "Belum ada versi course.", en: "No course version yet." },

  // ---- manage-course ----
  addLevelFailed: { id: "Gagal tambah level: {error}", en: "Failed to add level: {error}" },
  levelAdded: { id: "Level ditambahkan.", en: "Level added." },
  reorderFailed: { id: "Gagal menyusun ulang: {error}", en: "Failed to reorder: {error}" },
  versionPublished: { id: "Terbit versi {version}.", en: "Published version {version}." },
  validationFailed: {
    id: "Validasi gagal — perbaiki daftar di bawah.",
    en: "Validation failed — fix the list below.",
  },
  publishFailed: { id: "Gagal publish: {error}", en: "Publish failed: {error}" },
  duplicateDone: { id: "Salinan dibuat: {courseId}.", en: "Copy created: {courseId}." },
  duplicateFailed: { id: "Gagal duplikat: {error}", en: "Duplicate failed: {error}" },
  archiveConfirm: {
    id: "Arsipkan course ini? Murid tidak akan melihatnya lagi.",
    en: "Archive this course? Students will no longer see it.",
  },
  archived: { id: "Course diarsipkan.", en: "Course archived." },
  failedGeneric: { id: "Gagal: {error}", en: "Failed: {error}" },
  newVersionDone: {
    id: "Versi {version} dibuat sebagai draft (struktur disalin). Versi published tak tersentuh.",
    en: "Version {version} created as a draft (structure copied). The published version is untouched.",
  },
  levelSection: { id: "Susunan level", en: "Level layout" },
  addLevelForm: { id: "Tambah level", en: "Add level" },
  levelTitleLabel: { id: "Judul level", en: "Level title" },
  objectiveLabel: { id: "Objective (min 10 karakter)", en: "Objective (min 10 characters)" },
  addLevelButton: { id: "+ Level", en: "+ Level" },
  noLevels: {
    id: "Belum ada level. Tambahkan via authoring lanjutan.",
    en: "No levels yet. Add them via advanced authoring.",
  },
  manageContent: { id: "Kelola isi", en: "Manage content" },
  moveUp: { id: "Naikkan {title}", en: "Move up {title}" },
  moveDown: { id: "Turunkan {title}", en: "Move down {title}" },
  issuesSection: { id: "Hasil validasi publish", en: "Publish validation results" },
  checklistHeading: { id: "Checklist sebelum publish", en: "Pre-publish checklist" },
  validating: { id: "Memvalidasi…", en: "Validating…" },
  validatePublish: { id: "Validasi & publish", en: "Validate & publish" },
  copying: { id: "Menyalin…", en: "Copying…" },
  newVersionButton: { id: "Buat versi baru (ADR-003)", en: "Create new version (ADR-003)" },
  archiveButton: { id: "Arsipkan", en: "Archive" },
  previewButton: { id: "Preview sebagai murid", en: "Preview as student" },
  duplicateForm: { id: "Form duplikat course", en: "Duplicate course form" },
  duplicateSlugLabel: { id: "Slug salinan", en: "Copy slug" },
  duplicateButton: { id: "Duplikat course", en: "Duplicate course" },

  // ---- preview page ----
  previewLoadFailed: { id: "Preview tidak dapat dimuat.", en: "Preview could not be loaded." },
  backToManageCourse: { id: "← Kelola course", en: "← Manage course" },
  previewBadge: {
    id: "Preview sebagai murid — tanpa nilai & kunci jawaban",
    en: "Preview as student — no scores or answer keys",
  },
  previewNoContent: { id: "Belum ada konten pada versi ini.", en: "No content in this version yet." },
  previewLevel: { id: "Level {n}: {title}", en: "Level {n}: {title}" },
  previewNoLessons: { id: "Belum ada lesson.", en: "No lessons yet." },
  previewLesson: { id: "Lesson {n}: {title}", en: "Lesson {n}: {title}" },

  // ---- course index (app/(teacher)/teacher/courses/page.tsx) ----
  listTitle: { id: "Kursus saya", en: "My courses" },
  listIntro: {
    id: "Kelola materi, level, dan versi kursus Anda.",
    en: "Manage your materials, levels, and course versions.",
  },
  listEmpty: { id: "Belum ada kursus.", en: "No courses yet." },
  listEmptyDesc: {
    id: "Buat kursus pertama Anda untuk mulai mengajar.",
    en: "Create your first course to start teaching.",
  },
  statusPublished: { id: "Terbit", en: "Published" },
  statusDraft: { id: "Draft", en: "Draft" },
  statusArchived: { id: "Diarsipkan", en: "Archived" },
} as const;
