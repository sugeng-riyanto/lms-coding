import type { TextDict } from "@/lib/i18n";

/** Halaman Spaced review murid (app/(student)/review) — server + client. */
export const REVIEW: TextDict = {
  eyebrow: { id: "Ulasan terjadwal", en: "Scheduled review" },
  title: { id: "Spaced review", en: "Spaced review" },
  noEnrollment: {
    id: "Belum ada enrollment aktif. Hubungi guru Anda untuk didaftarkan ke kelas.",
    en: "No active enrollment yet. Ask your teacher to enroll you in a class.",
  },
  noneDue: {
    id: "Tidak ada review yang jatuh tempo. Kembali lagi sesuai jadwal — retrieval practice memperkuat ingatan jangka panjang. 🧠",
    en: "No reviews are due. Come back on schedule — retrieval practice strengthens long-term memory. 🧠",
  },
  confidenceNotUnderstood: { id: "Tidak paham", en: "Not understood" },
  confidenceSomewhat: { id: "Kurang paham", en: "Somewhat unclear" },
  confidenceOkay: { id: "Cukup", en: "Okay" },
  confidenceUnderstood: { id: "Paham", en: "Understood" },
  confidenceVery: { id: "Sangat paham", en: "Very confident" },
  overdueDays: { id: "Terlambat {n} hari", en: "{n} days overdue" },
  dueToday: { id: "Jatuh tempo hari ini", en: "Due today" },
  dueInDays: { id: "Jatuh tempo {n} hari lagi", en: "Due in {n} days" },
  doneNext: {
    id: 'Review "{title}" selesai. Berikutnya {date}.',
    en: 'Review "{title}" done. Next: {date}.',
  },
  notDue: { id: "Item ini belum jatuh tempo.", en: "This item is not due yet." },
  notScheduled: {
    id: "Item sudah dikerjakan atau tidak ditemukan.",
    en: "This item was already done or could not be found.",
  },
  saveFailed: { id: "Gagal menyimpan review. Coba lagi.", en: "Failed to save review. Try again." },
  queueSummary: {
    id: "{course} — {n} item jatuh tempo. Nilai pemahamanmu; jadwal berikutnya menyesuaikan (≤2 ulangi, 3 sama, ≥4 maju).",
    en: "{course} — {n} items due. Rate your understanding; the next schedule adjusts (≤2 repeat, 3 same, ≥4 advance).",
  },
  howWell: { id: "Seberapa paham kamu dengan materi ini?", en: "How well do you understand this material?" },
  itemAria: { id: "Review {title}", en: "Review {title}" },
} as const;
