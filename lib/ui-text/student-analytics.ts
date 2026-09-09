import type { TextDict } from "@/lib/i18n";

/** Student-facing analytics dashboard. */
export const STUDENT_ANALYTICS = {
  title: { id: "Analitik Belajar Saya", en: "My Learning Analytics" },
  subtitle: {
    id: "Ringkasan aktivitas, skor kuis, dan tren belajarmu.",
    en: "Summary of your activity, quiz scores, and learning trends.",
  },
  noData: {
    id: "Belum ada data belajar. Mulai belajar untuk melihat analitikmu di sini.",
    en: "No learning data yet. Start studying to see your analytics here.",
  },

  // Summary cards
  totalMinutes: { id: "Total Menit Aktif", en: "Total Active Minutes" },
  avgScore: { id: "Rata-rata Skor Kuis", en: "Avg Quiz Score" },
  totalAttempts: { id: "Total Percobaan", en: "Total Attempts" },
  coursesEnrolled: { id: "Kursus Diikuti", en: "Courses Enrolled" },

  // Activity chart
  activityChartTitle: { id: "Aktivitas belajar 14 hari terakhir", en: "Learning activity (last 14 days)" },
  activityChartEmpty: {
    id: "Belum ada menit aktif tercatat. Buka lesson dan mulai belajar.",
    en: "No active minutes recorded yet. Open a lesson and start studying.",
  },

  // Quiz chart
  quizChartTitle: { id: "Tren skor kuis", en: "Quiz score trend" },
  quizChartEmpty: {
    id: "Belum ada kuis yang dinilai.",
    en: "No graded quizzes yet.",
  },

  // Recent activity
  recentActivity: { id: "Aktivitas terbaru", en: "Recent activity" },
  activityLine: { id: "{minutes} menit aktif · {activities} aktivitas", en: "{minutes} min active · {activities} activities" },
} satisfies TextDict;
