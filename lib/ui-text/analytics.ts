import type { TextDict } from "@/lib/i18n";

/** Teacher analytics `/teacher/analytics` surface (page + AnalyticsFilters). */
export const ANALYTICS = {
  title: { id: "Analitik kelas", en: "Class analytics" },
  cohortLabel: { id: "Cohort: {name}", en: "Cohort: {name}" },
  exportCsv: { id: "Ekspor CSV", en: "Export CSV" },
  noCohort: {
    id: "Belum ada cohort yang Anda ampu. Buat cohort lalu daftarkan murid untuk melihat analitik.",
    en: "You do not teach any cohort yet. Create a cohort and enroll students to see analytics.",
  },
  digestAria: { id: "Prioritas tindakan minggu ini", en: "This week's action priorities" },
  digestTitle: { id: "Prioritas minggu ini", en: "This week's priorities" },
  priorityLabel: { id: "Prioritas {p}", en: "Priority {p}" },
  open: { id: "Buka", en: "Open" },

  // Filters
  filterCohort: { id: "Cohort", en: "Cohort" },
  filterAssessment: { id: "Assessment", en: "Assessment" },
  allAssessments: { id: "Semua assessment", en: "All assessments" },

  // Class distribution
  distAria: { id: "Distribusi kelas", en: "Class distribution" },
  distTitle: { id: "Distribusi kelas", en: "Class distribution" },
  progressTitle: { id: "Kemajuan murid", en: "Student progress" },
  progressDesc: {
    id: "Sebaran persentase lesson selesai per murid terhadap total lesson di versi terbit kursusnya — bukan perkiraan, melainkan hasil hitung dari progress_snapshots.",
    en: "Spread of the percentage of lessons completed per student against the total lessons in their course's published version — not an estimate, computed from progress_snapshots.",
  },
  progressFootnote: {
    id: "Definisi {def}. n = {n} murid berenrollment aktif; rata-rata {avg}%.",
    en: "Definitions {def}. n = {n} actively enrolled students; average {avg}%.",
  },
  progressEmpty: {
    id: "Belum ada murid dengan lesson terhitung. Distribusi muncul setelah murid mulai menyelesaikan lesson.",
    en: "No students with counted lessons yet. The distribution appears once students start completing lessons.",
  },
  progressAria: {
    id: "Distribusi jumlah murid per rentang persentase kemajuan lesson",
    en: "Distribution of student counts per lesson-progress percentage band",
  },
  scoreTitle: { id: "Skor asesmen (final)", en: "Assessment scores (final)" },
  scoreDesc: {
    id: "Sebaran skor final 0–100 per attempt yang sudah dinilai, untuk {scope}. Batang = jumlah attempt pada rentang skor.",
    en: "Spread of final 0–100 scores per graded attempt, for {scope}. Bars = number of attempts in each score band.",
  },
  scoreFootnote: {
    id: "Definisi {def}. n = {n} attempt dinilai; rata-rata {avg}%. Skor dihitung server, bukan browser.",
    en: "Definitions {def}. n = {n} graded attempts; average {avg}%. Scores are computed server-side, never in the browser.",
  },
  scoreEmpty: {
    id: "Belum ada attempt ber-skor untuk cakupan ini. Filter asesmen di atas untuk mempersempit.",
    en: "No scored attempts in this scope yet. Use the assessment filter above to narrow it down.",
  },
  scoreAria: {
    id: "Distribusi jumlah attempt per rentang skor asesmen final",
    en: "Distribution of attempt counts per final assessment-score band",
  },
  allScope: { id: "semua asesmen", en: "all assessments" },
  selectedScope: { id: "asesmen terpilih", en: "the selected assessment" },

  // Item analysis
  itemAria: { id: "Item analysis", en: "Item analysis" },
  itemTitle: { id: "Analisis butir soal", en: "Item analysis" },
  itemEmpty: {
    id: "Belum ada attempt soal pilihan di cohort ini untuk dianalisis.",
    en: "No multiple-choice attempts in this cohort to analyze yet.",
  },
  colQuestion: { id: "Soal", en: "Question" },
  colType: { id: "Tipe", en: "Type" },
  colDifficulty: { id: "Kesulitan (p)", en: "Difficulty (p)" },
  colOmit: { id: "Dilewati", en: "Omitted" },
  colDiscrimination: { id: "Diskriminasi", en: "Discrimination" },
  noPromptText: { id: "Tanpa teks soal", en: "No question text" },
  noPromptFallback: { id: "(tanpa teks)", en: "(no text)" },
  discSmallTitle: {
    id: "Ukuran kelompok terlalu kecil untuk diskriminasi (min 3 per kelompok)",
    en: "Group sizes too small for discrimination (minimum 3 per group)",
  },
  discTitle: {
    id: "p(kelompok atas) − p(kelompok bawah), tercile",
    en: "p(top group) − p(bottom group), tercile",
  },

  // Misconception map
  misconceptAria: { id: "Peta miskonsepsi", en: "Misconception map" },
  misconceptTitle: { id: "Peta miskonsepsi (pilihan jawaban)", en: "Misconception map (answer choices)" },
  misconceptDesc: {
    id: "Distribusi opsi salah yang dipilih murid — bukti perilaku, bukan diagnosis. Setiap cluster menampilkan pemilihnya.",
    en: "Distribution of wrong options students picked — behavioral evidence, not a diagnosis. Each cluster lists who picked it.",
  },
  misconceptEmpty: {
    id: "Belum ada distractor terpilih untuk dipetakan.",
    en: "No selected distractors to map yet.",
  },
  misconceptSummary: {
    id: "{id} — {n} jawaban, {incorrect} salah",
    en: "{id} — {n} answers, {incorrect} wrong",
  },
  optionLabel: {
    id: "Opsi “{opt}” — dipilih {picked}× ({share} dari yang salah)",
    en: "Option “{opt}” — picked {picked}× ({share} of the wrong ones)",
  },
  emptyOption: { id: "(opsi kosong)", en: "(empty option)" },
  students: { id: "Murid:", en: "Students:" },

  // Bottleneck
  bottleneckAria: { id: "Hambatan jalur belajar", en: "Learning-path bottlenecks" },
  bottleneckTitle: { id: "Hambatan jalur belajar", en: "Learning-path bottlenecks" },
  bottleneckDesc: {
    id: "Lesson yang banyak dibuka tapi jarang diselesaikan (dropoff = 1 − selesai/mulai).",
    en: "Lessons that are opened often but rarely completed (dropoff = 1 − completed/started).",
  },
  bottleneckEmpty: {
    id: "Belum ada aktivitas lesson untuk dianalisis.",
    en: "No lesson activity to analyze yet.",
  },
  colLesson: { id: "Lesson", en: "Lesson" },
  colStatus: { id: "Status", en: "Status" },
  colStarted: { id: "Mulai", en: "Started" },
  colCompleted: { id: "Selesai", en: "Completed" },
  colDropoff: { id: "Dropoff", en: "Dropoff" },
  severitySmallN: { id: "n kecil", en: "small n" },
  severityHigh: { id: "Hambatan", en: "Bottleneck" },
  severityWatch: { id: "Perhatikan", en: "Watch" },
  severityOk: { id: "Normal", en: "Normal" },

  // Footer
  footer: {
    id: "Definisi metrik: item {item} · dashboard {dash} · diperbarui {at} · statistik menyertakan ukuran sampel (n); diskriminasi disembunyikan bila kelompok terlalu kecil.",
    en: "Metric definitions: item {item} · dashboard {dash} · updated {at} · statistics include sample size (n); discrimination is hidden when groups are too small.",
  },
} as const satisfies TextDict;
