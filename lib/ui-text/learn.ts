import type { TextDict } from "@/lib/i18n";

/** Student learning surfaces: `/learn` (dashboard), `/learn/[id]` (level map). */
export const LEARN = {
  eyebrow: { id: "Ruang Belajar", en: "Learning Space" },
  fallbackTitle: { id: "Target hari ini", en: "Today's targets" },
  noEnrollment: {
    id: "Belum ada enrollment aktif. Hubungi guru Anda untuk didaftarkan ke kelas.",
    en: "No active enrollment yet. Ask your teacher to enroll you in a class.",
  },
  // Hero recommendation
  recAria: { id: "Rekomendasi belajar", en: "Learning recommendation" },
  nextStep: { id: "Langkah berikutnya", en: "Next step" },
  continueLearning: { id: "Lanjutkan belajar", en: "Continue learning" },
  allDone: {
    id: "Semua level selesai atau masih terkunci — pertahankan konsistensimu.",
    en: "All levels are done or still locked — keep up the momentum.",
  },
  // Weekly target
  weeklyAria: { id: "Target mingguan", en: "Weekly target" },
  weeklyRingAria: { id: "Progress target mingguan", en: "Weekly target progress" },
  weeklyTarget: { id: "Target mingguan", en: "Weekly target" },
  weeklyMinuteSummary: {
    id: "{done} dari {goal} menit aktif",
    en: "{done} of {goal} active minutes",
  },
  weeklyCompletionSummary: { id: "{done}/{goal} selesai", en: "{done}/{goal} completed" },
  weeklyAchieved: {
    id: "Target minggu ini tercapai. Pertahankan!",
    en: "This week's target reached. Keep it up!",
  },
  weeklyRemainingMinutes: {
    id: "{remaining} lagi untuk mencapai target minggu ini.",
    en: "{remaining} more to reach this week's target.",
  },
  weeklyRemainingCompletions: {
    id: "{remaining} aktivitas lagi untuk mencapai target minggu ini.",
    en: "{remaining} more activities to reach this week's target.",
  },
  goalAria: { id: "Pengaturan target", en: "Goal settings" },

  // Weekly goal form (client)
  goalUnitLabel: { id: "Satuan target", en: "Goal unit" },
  goalUnitMinutes: { id: "Menit belajar aktif", en: "Active study minutes" },
  goalUnitCompletions: { id: "Aktivitas selesai", en: "Completed activities" },
  goalValueLabelMinutes: { id: "Target (menit/minggu)", en: "Target (minutes/week)" },
  goalValueLabelCompletions: { id: "Target (aktivitas/minggu)", en: "Target (activities/week)" },
  goalSave: { id: "Setel target", en: "Set goal" },
  goalSaving: { id: "Menyimpan…", en: "Saving…" },
  goalFailed: { id: "Gagal: {err}", en: "Failed: {err}" },
  goalSavedMinutes: { id: "Tersimpan — target menit: {goal}.", en: "Saved — minute target: {goal}." },
  goalSavedCompletions: {
    id: "Tersimpan — target aktivitas: {goal}.",
    en: "Saved — activity target: {goal}.",
  },

  // Charts
  activeChartTitle: { id: "Menit aktif minggu ini", en: "Active minutes this week" },
  activeChartDesc: {
    id: "Belajar nyata diukur dari detik aktif (heartbeat terbatas, di-clamp server) — bukan dari halaman yang sekadar terbuka.",
    en: "Real study time is measured from active seconds (rate-limited heartbeat, clamped server-side) — not from merely opening a page.",
  },
  activeChartFootnote: {
    id: "Batang = menit aktif per hari (Sen–Min); jumlahnya sejalan dengan ring target di atas. Data: study_sessions.",
    en: "Bars = active minutes per day (Mon–Sun); totals match the target ring above. Data: study_sessions.",
  },
  activeChartEmpty: {
    id: "Belum ada menit aktif tercatat minggu ini. Buka lesson dari rekomendasi di atas dan mulai belajar — grafik terisi otomatis.",
    en: "No active minutes recorded this week yet. Open a lesson from the recommendation above and start studying — the chart fills in automatically.",
  },
  activeChartAria: {
    id: "Diagram batang menit aktif belajar per hari dalam minggu ini",
    en: "Bar chart of active study minutes per day this week",
  },
  quizChartTitle: { id: "Skor kuis terakhir", en: "Latest quiz scores" },
  quizChartDesc: {
    id: "Skor final (0–100) yang dihitung server untuk tiap percobaan kuis yang sudah dinilai — hingga 6 percobaan terakhir.",
    en: "Final (0–100) scores computed server-side for each graded quiz attempt — up to the latest 6 attempts.",
  },
  quizChartFootnote: {
    id: "Kunci jawaban dan penilaian tidak pernah dihitung di browser; grafik membaca attempts.final_score.",
    en: "Answer keys and grading never run in the browser; the chart reads attempts.final_score.",
  },
  quizChartEmpty: {
    id: "Belum ada kuis yang dinilai. Kerjakan kuis di jalur level untuk melihat tren skormu di sini.",
    en: "No graded quizzes yet. Take a quiz on your level path to see your score trend here.",
  },
  quizChartAria: {
    id: "Diagram batang skor kuis final per percobaan terakhir",
    en: "Bar chart of final quiz scores across recent attempts",
  },
  quizFallbackTitle: { id: "Kuis", en: "Quiz" },
  quizAttemptHint: { id: "Percobaan {n}", en: "Attempt {n}" },

  // Level journey
  pathTitle: { id: "Jalur level", en: "Level path" },
  pathHint: { id: "{n} level dalam kursus ini", en: "{n} levels in this course" },
  stateLocked: { id: "Terkunci — selesaikan prerequisite", en: "Locked — complete the prerequisite" },
  stateCompleted: { id: "Mastery {pct}% — selesai", en: "Mastery {pct}% — completed" },
  stateInProgress: { id: "Mastery {pct}% — sedang dikerjakan", en: "Mastery {pct}% — in progress" },
  stateAvailable: { id: "Tersedia — mulai dari sini", en: "Available — start here" },
  statusAria: { id: "Status {title}", en: "Status of {title}" },
  masteryAria: { id: "Mastery {title}", en: "Mastery of {title}" },
  openLevel: { id: "Buka level", en: "Open level" },
  statLevelsDone: { id: "Level selesai", en: "Levels completed" },
  statInProgress: { id: "Dikerjakan", en: "In progress" },
  statLocked: { id: "Terkunci", en: "Locked" },
  catalogLink: { id: "Lihat katalog coursemu", en: "View your course catalog" },

  // Level map (/learn/[id])
  mapEyebrow: { id: "Peta level", en: "Level map" },
  noEnrollmentAlert: {
    id: "Belum ada enrollment aktif. Hubungi guru Anda untuk didaftarkan ke kelas.",
    en: "No active enrollment yet. Ask your teacher to enroll you in a class.",
  },
  allDoneBanner: {
    id: "✓ Semua aktivitas level ini selesai — lanjut ke level berikutnya dari dashboard.",
    en: "✓ Every activity in this level is complete — continue to the next level from your dashboard.",
  },
  mapLoadError: {
    id: "Peta level tidak dapat dimuat. Coba lagi nanti.",
    en: "The level map could not be loaded. Try again later.",
  },
  mapEmpty: {
    id: "Level ini belum memiliki modul/aktivitas.",
    en: "This level has no modules or activities yet.",
  },
  optional: { id: "(opsional)", en: "(optional)" },
  doneBadge: { id: "✓ Selesai", en: "✓ Done" },
  lockedBadge: { id: "🔒 Terkunci", en: "🔒 Locked" },
  availableBadge: { id: "Tersedia", en: "Available" },
  backToDashboard: { id: "Kembali ke dashboard", en: "Back to dashboard" },
  // Activity type badges
  badgeQuiz: { id: "Kuis/Ujian", en: "Quiz/Exam" },
  badgeArticle: { id: "Materi", en: "Lesson" },
  badgeVideoLink: { id: "Video", en: "Video" },
  badgeResource: { id: "Sumber belajar", en: "Resource" },
  badgeReflection: { id: "Refleksi", en: "Reflection" },
  badgeAssignmentUpload: { id: "Tugas", en: "Assignment" },
  badgeRobloxChallenge: { id: "Tantangan Roblox", en: "Roblox challenge" },
  badgeCodeBoard: { id: "Papan kode", en: "Code board" },
  badgeEmbedYoutube: { id: "Video YouTube", en: "YouTube video" },
  badgeEmbedPdf: { id: "PDF", en: "PDF" },
  badgeEmbedAudio: { id: "Audio", en: "Audio" },
  badgeEmbedFile: { id: "Berkas", en: "File" },
} as const satisfies TextDict;
