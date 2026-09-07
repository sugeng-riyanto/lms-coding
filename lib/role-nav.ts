import type { Role } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  desc: string;
}

/**
 * Navigasi sidebar per peran (sumber tunggal untuk AppShell + tests).
 * HANYA route yang memang boleh diakses peran itu (RBAC.md): murid belajar,
 * guru mengelola cohort-nya, wali ringkasan anak tertaut. Pengaturan + keluar
 * tersedia di SEMUA peran.
 */
export function navForRole(role: Role, isOrgAdmin: boolean): NavItem[] {
  const settings: NavItem = { href: "/settings", label: "Pengaturan", desc: "Akun & preferensi" };
  switch (role) {
    case "student":
      return [
        { href: "/learn", label: "Belajar", desc: "Target & jalur level" },
        { href: "/catalog", label: "Katalog", desc: "Semua kursusku" },
        { href: "/review", label: "Review", desc: "Ulasan terjadwal" },
        { href: "/certificates", label: "Sertifikat", desc: "Sertifikatku" },
        settings,
      ];
    case "teacher":
      return [
        { href: "/teacher", label: "Dasbor", desc: "Ringkasan kelas" },
        { href: "/teacher/cohorts", label: "Kelas", desc: "Cohort & enrollment" },
        { href: "/teacher/grading", label: "Penilaian", desc: "Antrian nilai manual" },
        { href: "/teacher/questions", label: "Bank Soal", desc: "Soal berversi" },
        { href: "/teacher/analytics", label: "Analitik", desc: "Insight kelas" },
        { href: "/teacher/certificates", label: "Sertifikat", desc: "Terbit & anchor" },
        // Facet Owner (ADR-008): hanya guru pemilik course yang melihat tautan admin.
        ...(isOrgAdmin
          ? [{ href: "/teacher/admin/map", label: "Admin", desc: "Mapping kelas & subjek" } satisfies NavItem]
          : []),
        settings,
      ];
    case "guardian":
      return [{ href: "/guardian", label: "Ringkasan", desc: "Perkembangan anak" }, settings];
  }
}
