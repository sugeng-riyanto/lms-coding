import type { TextDict } from "@/lib/i18n";

/** Halaman Profil (app/profile) — server + client. */
export const PROFILE: TextDict = {
  title: { id: "Profil", en: "Profile" },
  displayName: { id: "Nama tampilan", en: "Display name" },
  status: { id: "Status", en: "Status" },
  roles: { id: "Peran (server)", en: "Roles (server)" },
  unavailable: {
    id: "Profil belum tersedia. Hubungi admin sekolah.",
    en: "Profile not available yet. Contact your school administrator.",
  },
  updated: { id: "Nama diperbarui.", en: "Display name updated." },
  failed: { id: "Gagal: {error}", en: "Failed: {error}" },
  editAria: { id: "Ubah nama tampilan", en: "Edit display name" },
  save: { id: "Simpan", en: "Save" },
} as const;
