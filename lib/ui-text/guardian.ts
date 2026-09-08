import type { TextDict } from "@/lib/i18n";

/** Dashboard Wali (app/(guardian)/guardian) — server component. */
export const GUARDIAN: TextDict = {
  eyebrow: { id: "Portal Orang Tua / Wali", en: "Parent / Guardian Portal" },
  title: { id: "Ringkasan Perkembangan Anak", en: "Child Progress Summary" },
  intro: {
    id: "Ringkasan hanya menampilkan anak yang tertaut melalui guardian link aktif dan data yang diizinkan kebijakan akses (profil, pendaftaran, progres — bukan jawaban atau nilai terperinci).",
    en: "The summary only shows children linked through an active guardian link and data permitted by the access policy (profile, enrollments, progress — not answers or detailed scores).",
  },
  noChildrenBefore: {
    id: "Belum ada anak tertaut. Minta pihak sekolah menautkan akun Anda sebagai wali (guardian link aktif) — misalnya ke bagian",
    en: "No linked children yet. Ask the school to link your account as a guardian (active guardian link) — for example via the",
  },
  profileLink: { id: "profil", en: "profile" },
  noChildrenAfter: { id: ".", en: " section." },
  summaryAria: { id: "Ringkasan {name}", en: "Summary for {name}" },
  linkedSince: { id: "Tertaut sejak {date}", en: "Linked since {date}" },
  statusAria: { id: "Status {name}", en: "Status of {name}" },
  linkedActive: { id: "Tertaut aktif", en: "Active link" },
  progressAria: { id: "Progress belajar {name}", en: "Learning progress for {name}" },
  activeEnrollments: { id: "Enrollment aktif", en: "Active enrollments" },
  avgMastery: { id: "Mastery rata-rata", en: "Average mastery" },
  lastActive: { id: "Terakhir aktif", en: "Last active" },
  levelsCompleted: { id: "Level tuntas", en: "Levels completed" },
  today: { id: "Hari ini", en: "Today" },
  daysAgo: { id: "{n} hari", en: "{n} days" },
  progressFootnote: {
    id: "Level tuntas {done} dari {total} pada enrollment aktif.",
    en: "{done} of {total} levels completed on active enrollments.",
  },
  noProgress: {
    id: "Belum ada progres tercatat — data muncul setelah anak mulai belajar.",
    en: "No recorded progress yet — data appears once the child starts learning.",
  },
  certAuto: { id: "Sertifikat terbit otomatis", en: "Certificates issued automatically" },
  noCerts: {
    id: "Belum ada sertifikat — akan muncul otomatis saat quiz 100% dan ujian akhir ≥ 70%.",
    en: "No certificates yet — they appear automatically once quizzes reach 100% and the final exam is ≥ 70%.",
  },
  downloadPdf: { id: "Unduh PDF resmi", en: "Download official PDF" },
  verify: { id: "Verifikasi", en: "Verify" },
  revokedNote: {
    id: "Sertifikat ini dicabut; unduhan valid tidak tersedia.",
    en: "This certificate has been revoked; a valid download is unavailable.",
  },
} as const;
