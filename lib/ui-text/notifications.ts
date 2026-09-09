import type { TextDict } from "@/lib/i18n";

export const NOTIFICATIONS = {
  title: { id: "Notifikasi", en: "Notifications" },
  ariaLabel: { id: "Buka notifikasi", en: "Open notifications" },
  markAllRead: { id: "Tandai semua sudah dibaca", en: "Mark all read" },
  empty: { id: "Belum ada notifikasi", en: "No notifications yet" },
  quizSubmission: { id: "Kuis dikumpulkan", en: "Quiz submitted" },
  assignmentSubmission: { id: "Tugas dikumpulkan", en: "Assignment submitted" },
  newEnrollment: { id: "Pendaftaran baru", en: "New enrollment" },
} satisfies TextDict;
