import type { TextDict } from "@/lib/i18n";

/** Halaman aktivitas murid (app/(student)/activities/[activityId]) — client. */
export const ACTIVITY: TextDict = {
  noEnrollment: {
    id: "Enrollment tidak diketahui — buka activity dari katalog.",
    en: "Enrollment unknown — open the activity from the catalog.",
  },
  markedComplete: { id: "Ditandai selesai.", en: "Marked as complete." },
  failed: { id: "Gagal: {error}", en: "Failed: {error}" },
  quizNotReady: { id: "Quiz/enrollment belum siap.", en: "Quiz/enrollment not ready yet." },
  startFailed: { id: "Gagal mulai: {error}", en: "Failed to start: {error}" },
  markComplete: { id: "Tandai selesai", en: "Mark as complete" },
  contentNotFilled: { id: "Konten belum diisi guru.", en: "Content not provided by the teacher yet." },
  watchVideo: { id: "Tonton video", en: "Watch video" },
  downloadMaterial: { id: "Unduh materi", en: "Download material" },
  noFile: { id: "Belum ada file.", en: "No file yet." },
  codeNotProvided: { id: "Kode belum diisi oleh pengajar.", en: "Code not provided by the teacher yet." },
  transcript: { id: "Penjelasan (transkrip)", en: "Explanation (transcript)" },
  quizIntro: {
    id: "Kuis interaktif dengan timer & batas attempt server-side.",
    en: "Interactive quiz with a server-side timer and attempt limits.",
  },
  startQuiz: { id: "Mulai kuis", en: "Start quiz" },
  fileUploadedHint: {
    id: "File terunggah. Tandai selesai bila sudah cukup.",
    en: "File uploaded. Mark as complete when you are done.",
  },
  robloxTitle: {
    id: "Tantangan Roblox (dibuka di aplikasi Roblox)",
    en: "Roblox challenge (opens in the Roblox app)",
  },
  openRoblox: { id: "Buka di Roblox", en: "Open in Roblox" },
  expectedEvidence: { id: "Bukti yang diharapkan: {evidence}", en: "Expected evidence: {evidence}" },
  robloxNote: {
    id: "Skor game tidak otomatis jadi nilai. Completion diverifikasi guru atau via integrasi server Tahap B.",
    en: "Game scores do not become grades automatically. Completion is verified by the teacher or via Phase B server integration.",
  },
  contentUnavailable: { id: "Konten belum tersedia.", en: "Content not available yet." },
  reflectionLabel: { id: "Refleksi (disimpan otomatis)", en: "Reflection (saved automatically)" },
  reflectionPlaceholder: {
    id: "Apa yang kamu pelajari? Bagian mana yang masih sulit?",
    en: "What did you learn? Which part still feels difficult?",
  },
  draftSaving: { id: "Menyimpan…", en: "Saving…" },
  loading: { id: "Memuat…", en: "Loading…" },
  draftSaved: { id: "Tersimpan", en: "Saved" },
  draftOffline: {
    id: "Offline — draf tersimpan lokal, akan dikirim ulang",
    en: "Offline — draft saved locally, will be sent again",
  },
  draftError: {
    id: "Gagal menyimpan — draf aman di perangkat ini",
    en: "Save failed — draft is safe on this device",
  },
  offlineUnavailableTitle: { id: "Konten belum tersedia offline.", en: "Content not available offline yet." },
  offlineUnavailableBody: {
    id: "Activity ini belum pernah dibuka saat terhubung, jadi belum ada salinan lokal. Buka sekali saat koneksi tersedia agar bisa dibaca saat offline.",
    en: "This activity has not been opened while online yet, so there is no local copy. Open it once when you have a connection so it can be read offline.",
  },
} as const;
