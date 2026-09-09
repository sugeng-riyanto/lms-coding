import type { TextDict } from "@/lib/i18n";

export const NOTIFICATIONS = {
  title: { id: "Notifikasi", en: "Notifications" },
  ariaLabel: { id: "Buka notifikasi", en: "Open notifications" },
  markAllRead: { id: "Tandai semua sudah dibaca", en: "Mark all read" },
  empty: { id: "Belum ada notifikasi", en: "No notifications yet" },
  quizSubmission: { id: "Kuis dikumpulkan", en: "Quiz submitted" },
  assignmentSubmission: { id: "Tugas dikumpulkan", en: "Assignment submitted" },
  newEnrollment: { id: "Pendaftaran baru", en: "New enrollment" },
  // ---- Intervention queue notifications ----
  alertAssigned: { id: "Anda ditugaskan intervensi", en: "Intervention assigned to you" },
  alertDueSoon: { id: "Intervensi mendekati batas", en: "Intervention due soon" },
  alertOverdue: { id: "Intervensi terlambat", en: "Intervention overdue" },
  alertReopened: { id: "Intervensi dibuka kembali", en: "Intervention reopened" },
  alertResolved: { id: "Intervensi diselesaikan", en: "Intervention resolved" },
  gradeReleased: { id: "Nilai dirilis", en: "Grades released" },
  markRead: { id: "Tandai sudah dibaca", en: "Mark as read" },
  unreadCount: { id: "{n} belum dibaca", en: "{n} unread" },
} satisfies TextDict;
