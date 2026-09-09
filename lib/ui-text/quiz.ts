import type { TextDict } from "@/lib/i18n";

/** Halaman Kuis murid (app/(student)/quiz/[attemptId]) — server + client. */
export const QUIZ: TextDict = {
  loadFailed: { id: "Kuis tidak dapat dimuat.", en: "Quiz could not be loaded." },
  attemptStatus: { id: "Percobaan {status}", en: "Attempt {status}" },
  alreadySubmitted: {
    id: "Attempt ini sudah dikirim. Lihat hasil sesuai release policy guru.",
    en: "This attempt has already been submitted. See results according to your teacher's release policy.",
  },
  title: { id: "Kuis", en: "Quiz" },
  autosaveNote: {
    id: "Jawaban tersimpan otomatis. Timer dan batas attempt dihitung server.",
    en: "Answers are saved automatically. Timer and attempt limits are enforced server-side.",
  },
  confirmSubmit: {
    id: "Kirim jawaban? Attempt akan dikunci.",
    en: "Submit answers? The attempt will be locked.",
  },
  timeExpired: { id: "Waktu habis — hubungi guru.", en: "Time is up — contact your teacher." },
  submitFailed: { id: "Gagal submit: {error}", en: "Submit failed: {error}" },
  saveFailed: { id: "Gagal menyimpan: {error}", en: "Save failed: {error}" },
  essayPlaceholder: { id: "Tulis jawabanmu…", en: "Write your answer…" },
  filePlaceholder: { id: "Deskripsikan file proyekmu…", en: "Describe your project file…" },
  saving: { id: "Menyimpan…", en: "Saving…" },
  questionLabel: { id: "Soal {n}", en: "Question {n}" },
  points: { id: "{points} poin", en: "{points} points" },
  submitting: { id: "Mengirim…", en: "Submitting…" },
  submitWithStatus: {
    id: "Kirim jawaban (status: {status})",
    en: "Submit answers (status: {status})",
  },
  fileUploaded: { id: "File terunggah: {path}", en: "Uploaded file: {path}" },
  results: { id: "Hasil", en: "Results" },
  resultTitle: { id: "Hasil: {score}", en: "Result: {score}" },
  resultSubtitle: {
    id: "Lihat umpan balik per butir soal di bawah.",
    en: "See per-question feedback below.",
  },
  autoScore: { id: "Otomatis: {score}", en: "Auto: {score}" },
  manualScore: { id: " · Manual: {score}", en: " · Manual: {score}" },
  pendingRelease: {
    id: "Jawaban terkirim. Nilai menunggu release guru.",
    en: "Answers submitted. Score awaits teacher release.",
  },
  // Feedback loop
  loadingFeedback: { id: "Memuat umpan balik…", en: "Loading feedback…" },
  feedbackSection: { id: "Umpan balik per soal", en: "Per-question feedback" },
  feedbackTitle: { id: "Umpan balik Jawaban", en: "Answer Feedback" },
  feedbackSummary: {
    id: "Benar {correct} dari {total} soal otomatis.",
    en: "Correct {correct} out of {total} auto-graded questions.",
  },
  yourAnswer: { id: "Jawabanmu", en: "Your answer" },
  correctAnswer: { id: "Jawaban benar", en: "Correct answer" },
  score: { id: "Skor", en: "Score" },
  awaitingManualGrade: {
    id: "Menunggu penilaian manual oleh guru.",
    en: "Awaiting manual grading by your teacher.",
  },
  showExplanation: { id: "Tampilkan penjelasan", en: "Show explanation" },
  hideExplanation: { id: "Sembunyikan penjelasan", en: "Hide explanation" },
  badgeCorrect: { id: "Benar", en: "Correct" },
  badgeIncorrect: { id: "Salah", en: "Incorrect" },
  badgePending: { id: "Menunggu", en: "Pending" },
} as const;
