import type { Role } from "@/lib/permissions";
import { NAV, type Lang } from "@/lib/i18n";

export interface NavItem {
  href: string;
  label: string;
  desc: string;
  group?: string;
}

/**
 * Navigasi sidebar per peran (sumber tunggal untuk AppShell + tests).
 * Label & deskripsi mengikuti preferensi bahasa pengguna (lib/i18n).
 * HANYA route yang memang boleh diakses peran itu (RBAC.md): murid belajar,
 * guru mengelola cohort-nya, wali ringkasan anak tertaut. Pengaturan + keluar
 * tersedia di SEMUA peran.
 *
 * Guru nav digrup: Overview → Content → Students → Tools → Admin.
 */
export function navForRole(role: Role, isOrgAdmin: boolean, lang: Lang = "id"): NavItem[] {
  const p = (key: keyof typeof NAV) => ({ id: NAV[key].id, en: NAV[key].en })[lang];
  const settings: NavItem = {
    href: "/settings",
    label: p("settings"),
    desc: p("settingsDesc"),
    group: "_settings",
  };
  switch (role) {
    case "student":
      return [
        { href: "/learn", label: p("studentLearn"), desc: p("studentLearnDesc"), group: "_main" },
        { href: "/catalog", label: p("studentCatalog"), desc: p("studentCatalogDesc"), group: "_main" },
        { href: "/review", label: p("studentReview"), desc: p("studentReviewDesc"), group: "_main" },
        {
          href: "/certificates",
          label: p("studentCertificates"),
          desc: p("studentCertificatesDesc"),
          group: "_main",
        },
        {
          href: "/analytics",
          label: p("studentAnalytics"),
          desc: p("studentAnalyticsDesc"),
          group: "_main",
        },
        settings,
      ];
    case "teacher":
      return [
        // ── Overview ──
        {
          href: "/teacher",
          label: p("teacherDashboard"),
          desc: p("teacherDashboardDesc"),
          group: "_overview",
        },
        {
          href: "/teacher/analytics",
          label: p("teacherAnalytics"),
          desc: p("teacherAnalyticsDesc"),
          group: "_overview",
        },
        // ── Content ──
        {
          href: "/teacher/courses",
          label: p("teacherCourses"),
          desc: p("teacherCoursesDesc"),
          group: "_content",
        },
        {
          href: "/teacher/questions",
          label: p("teacherQuestions"),
          desc: p("teacherQuestionsDesc"),
          group: "_content",
        },
        // ── Students ──
        {
          href: "/teacher/cohorts",
          label: p("teacherClasses"),
          desc: p("teacherClassesDesc"),
          group: "_students",
        },
        {
          href: "/teacher/grading",
          label: p("teacherGrading"),
          desc: p("teacherGradingDesc"),
          group: "_students",
        },
        {
          href: "/teacher/certificates",
          label: p("teacherCertificates"),
          desc: p("teacherCertificatesDesc"),
          group: "_students",
        },
        // ── Admin (org-admin only) ──
        ...(isOrgAdmin
          ? [
              {
                href: "/teacher/admin/map",
                label: p("adminMap"),
                desc: p("adminMapDesc"),
                group: "_admin",
              } satisfies NavItem,
              {
                href: "/teacher/admin/security",
                label: p("adminSecurity"),
                desc: p("adminSecurityDesc"),
                group: "_admin",
              } satisfies NavItem,
            ]
          : []),
        settings,
      ];
    case "guardian":
      return [
        { href: "/guardian", label: p("guardianSummary"), desc: p("guardianSummaryDesc"), group: "_main" },
        settings,
      ];
  }
}
