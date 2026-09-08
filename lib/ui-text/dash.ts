import type { TextDict } from "@/lib/i18n";

/** Teacher dashboard `/teacher` + its AlertControls client component. */
export const DASH = {
  // Page states
  loadError: { id: "Dashboard tidak dapat dimuat.", en: "Dashboard could not be loaded." },
  emptyTitle: { id: "Dashboard kelas", en: "Class dashboard" },
  emptyNoCohort: {
    id: "Belum ada cohort yang Anda ampu.",
    en: "You do not teach any cohort yet.",
  },
  title: { id: "Dasbor Kelas", en: "Class Dashboard" },
  summaryAria: { id: "Ringkasan", en: "Summary" },
  exportCsv: { id: "Export CSV", en: "Export CSV" },

  // Stat cards
  enrolled: { id: "Terdaftar", en: "Enrolled" },
  enrolledHint: { id: "Murid di cohort", en: "Students in the cohort" },
  active7d: { id: "Aktif 7 hari", en: "Active 7 days" },
  active7dHint: { id: "Ada aktivitas", en: "Had activity" },
  avgProgress: { id: "Rata-rata progress", en: "Average progress" },
  avgProgressHint: { id: "Penyelesaian lesson", en: "Lesson completion" },
  avgMastery: { id: "Rata-rata mastery", en: "Average mastery" },
  avgMasteryHint: { id: "Penguasaan kompetensi", en: "Competency mastery" },
  needsAttention: { id: "Perlu perhatian", en: "Needs attention" },
  needsAttentionHint: { id: "Di bawah 50% progress", en: "Below 50% progress" },

  metricsFootnote: {
    id: "Definisi metrik v2026-09-06/v1 · n={n} · diperbarui saat halaman dimuat",
    en: "Metric definitions v2026-09-06/v1 · n={n} · updated on page load",
  },

  // Cohort matrix
  matrixTitle: { id: "Matriks cohort", en: "Cohort matrix" },
  matrixHint: {
    id: "Baris murid · status selalu berupa teks",
    en: "One row per student · status is always text",
  },
  matrixEmpty: { id: "Belum ada murid di cohort ini.", en: "No students in this cohort yet." },
  statusAria: { id: "Status {name}", en: "Status of {name}" },
  statusWatch: { id: "⚠ Perlu perhatian", en: "⚠ Needs attention" },
  statusOnTrack: { id: "✓ On-track", en: "✓ On-track" },
  progress: { id: "Progress", en: "Progress" },
  mastery: { id: "Mastery", en: "Mastery" },
  submit: { id: "Submit", en: "Submit" },
  progressAria: { id: "Progress {name}", en: "Progress of {name}" },
  masteryAria: { id: "Mastery {name}", en: "Mastery of {name}" },
  colStudent: { id: "Murid", en: "Student" },
  colStatus: { id: "Status", en: "Status" },
  colDetail: { id: "Detail", en: "Detail" },
  detail: { id: "Detail", en: "Details" },

  // Risk signals
  riskTitle: { id: "Sinyal risiko", en: "Risk signals" },
  riskHint: { id: "Aturan transparan — bukan ranking", en: "Transparent rules — not a ranking" },

  // Teacher tools
  toolsTitle: { id: "Kelola kelas", en: "Manage classes" },
  toolsHint: { id: "Alat kerja guru", en: "Teacher tools" },
  toolsAria: { id: "Alat guru", en: "Teacher tools" },
  toolGrading: { id: "Antrian penilaian", en: "Grading queue" },
  toolGradingDesc: { id: "Nilai jawaban esai & tugas manual", en: "Grade essays & manual submissions" },
  toolQuestions: { id: "Bank soal", en: "Question bank" },
  toolQuestionsDesc: {
    id: "Buat soal berversi + kunci jawaban",
    en: "Create versioned questions + answer keys",
  },
  toolCohorts: { id: "Cohort & enrollment", en: "Cohorts & enrollment" },
  toolCohortsDesc: { id: "Kelola kelas dan pendaftaran murid", en: "Manage classes and student enrollment" },
  toolAnalytics: { id: "Analitik kelas", en: "Class analytics" },
  toolAnalyticsDesc: {
    id: "Butir soal, miskonsepsi, hambatan",
    en: "Item stats, misconceptions, bottlenecks",
  },
  toolCertificates: { id: "Sertifikat & anchoring", en: "Certificates & anchoring" },
  toolCertificatesDesc: {
    id: "Terbitkan, reissue, dan anchor batch",
    en: "Issue, reissue, and anchor in batches",
  },
  toolAdminMap: { id: "Admin: mapping", en: "Admin: mapping" },
  toolAdminMapDesc: {
    id: "Petakan murid & guru ke kelas/subjek",
    en: "Map students & teachers to classes/subjects",
  },

  // ---- AlertControls (client) ----
  noSignals: { id: "Tidak ada sinyal. 🎉", en: "No signals. 🎉" },
  acknowledge: { id: "Acknowledge", en: "Acknowledge" },
  snooze3d: { id: "Snooze 3 hari", en: "Snooze 3 days" },
  interventionNoteAria: { id: "Catatan intervensi {name}", en: "Intervention note for {name}" },
  interventionNotePlaceholder: { id: "Catatan intervensi…", en: "Intervention note…" },
  resolve: { id: "Resolve", en: "Resolve" },
  dismissSession: { id: "Dismiss sesi ini", en: "Dismiss for this session" },
} as const satisfies TextDict;
