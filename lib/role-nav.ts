import type { Role } from "@/lib/permissions";
import { NAV, type Lang } from "@/lib/i18n";

export interface NavItem {
  href: string;
  label: string;
  desc: string;
}

/**
 * Navigasi sidebar per peran (sumber tunggal untuk AppShell + tests).
 * Label & deskripsi mengikuti preferensi bahasa pengguna (lib/i18n).
 * HANYA route yang memang boleh diakses peran itu (RBAC.md): murid belajar,
 * guru mengelola cohort-nya, wali ringkasan anak tertaut. Pengaturan + keluar
 * tersedia di SEMUA peran.
 */
export function navForRole(role: Role, isOrgAdmin: boolean, lang: Lang = "id"): NavItem[] {
  const p = (key: keyof typeof NAV) => ({ id: NAV[key].id, en: NAV[key].en })[lang];
  const settings: NavItem = { href: "/settings", label: p("settings"), desc: p("settingsDesc") };
  switch (role) {
    case "student":
      return [
        { href: "/learn", label: p("studentLearn"), desc: p("studentLearnDesc") },
        { href: "/catalog", label: p("studentCatalog"), desc: p("studentCatalogDesc") },
        { href: "/review", label: p("studentReview"), desc: p("studentReviewDesc") },
        { href: "/certificates", label: p("studentCertificates"), desc: p("studentCertificatesDesc") },
        settings,
      ];
    case "teacher":
      return [
        { href: "/teacher", label: p("teacherDashboard"), desc: p("teacherDashboardDesc") },
        { href: "/teacher/cohorts", label: p("teacherClasses"), desc: p("teacherClassesDesc") },
        { href: "/teacher/grading", label: p("teacherGrading"), desc: p("teacherGradingDesc") },
        { href: "/teacher/questions", label: p("teacherQuestions"), desc: p("teacherQuestionsDesc") },
        { href: "/teacher/analytics", label: p("teacherAnalytics"), desc: p("teacherAnalyticsDesc") },
        {
          href: "/teacher/certificates",
          label: p("teacherCertificates"),
          desc: p("teacherCertificatesDesc"),
        },
        // Facet Owner (ADR-008): hanya guru pemilik course yang melihat tautan admin.
        ...(isOrgAdmin
          ? [
              {
                href: "/teacher/admin/map",
                label: p("adminMap"),
                desc: p("adminMapDesc"),
              } satisfies NavItem,
              {
                href: "/teacher/admin/security",
                label: p("adminSecurity"),
                desc: p("adminSecurityDesc"),
              } satisfies NavItem,
            ]
          : []),
        settings,
      ];
    case "guardian":
      return [{ href: "/guardian", label: p("guardianSummary"), desc: p("guardianSummaryDesc") }, settings];
  }
}
