/**
 * UI language preference (per-user, all RBAC surfaces).
 *
 * Policy (docs/language-policy.md): every authenticated user picks full English
 * or full Indonesian; the choice is stored on `profiles.language` (server-side,
 * self-service via RLS profiles_own_update) and read by server components
 * through `getLang()`. Client-only components read the `lms-lang` cookie set by
 * the same preference (cookie mirrors the profile value so shells like the
 * login screen, which run before auth, can render in the visitor's language).
 *
 * The dictionaries below cover the shared chrome (nav, eyebrows, settings,
 * auth/error shells). Page-specific strings use the same `Lang` type and
 * `t()` helper so a page can translate its own labels.
 */

export type Lang = "id" | "en";

export function isLang(v: unknown): v is Lang {
  return v === "id" || v === "en";
}

/**
 * Default UI language for accounts that have not made an explicit choice
 * (no cookie, no saved profile value). The school pilot is English-first:
 * everything renders in English until a user picks otherwise. The DB column
 * default stays 'id' deliberately — that stored value is the "never chose"
 * sentinel for persistLoginLanguage, not a UI default.
 */
export const DEFAULT_LANG: Lang = "en";

// ---------- Shared chrome dictionary -----------------------------------------

export const NAV = {
  settings: { id: "Pengaturan", en: "Settings" },
  settingsDesc: { id: "Akun & preferensi", en: "Account & preferences" },
  studentLearn: { id: "Belajar", en: "Learn" },
  studentLearnDesc: { id: "Target & jalur level", en: "Targets & level path" },
  studentCatalog: { id: "Katalog", en: "Catalog" },
  studentCatalogDesc: { id: "Semua kursusku", en: "All my courses" },
  studentReview: { id: "Review", en: "Review" },
  studentReviewDesc: { id: "Ulasan terjadwal", en: "Scheduled review" },
  studentCertificates: { id: "Sertifikat", en: "Certificates" },
  studentCertificatesDesc: { id: "Sertifikatku", en: "My certificates" },
  studentAnalytics: { id: "Analitik", en: "Analytics" },
  studentAnalyticsDesc: { id: "Statistik belajar", en: "Learning stats" },
  teacherDashboard: { id: "Dasbor", en: "Dashboard" },
  teacherDashboardDesc: { id: "Ringkasan kelas", en: "Class summary" },
  teacherCourses: { id: "Kursus", en: "Courses" },
  teacherCoursesDesc: { id: "Buat & kelola kursus", en: "Create & manage courses" },
  teacherClasses: { id: "Kelas", en: "Classes" },
  teacherClassesDesc: { id: "Cohort & enrollment", en: "Cohorts & enrollment" },
  teacherGrading: { id: "Penilaian", en: "Grading" },
  teacherGradingDesc: { id: "Antrian nilai manual", en: "Manual grading queue" },
  teacherQuestions: { id: "Bank Soal", en: "Question Bank" },
  teacherQuestionsDesc: { id: "Soal berversi", en: "Versioned questions" },
  teacherAnalytics: { id: "Analitik", en: "Analytics" },
  teacherAnalyticsDesc: { id: "Insight kelas", en: "Class insights" },
  teacherCertificates: { id: "Sertifikat", en: "Certificates" },
  teacherCertificatesDesc: { id: "Terbit & anchor", en: "Issue & anchor" },
  adminMap: { id: "Admin", en: "Admin" },
  adminMapDesc: { id: "Mapping kelas & subjek", en: "Class & subject mapping" },
  adminSecurity: { id: "Security", en: "Security" },
  adminSecurityDesc: { id: "Monitoring CSP", en: "CSP monitoring" },
  guardianSummary: { id: "Ringkasan", en: "Summary" },
  guardianSummaryDesc: { id: "Perkembangan anak", en: "Child progress" },
} as const;

export const EYEBROW = {
  student: { id: "Area Belajar Murid", en: "Student Learning Area" },
  teacher: { id: "Dasbor Kelas", en: "Class Dashboard" },
  guardian: { id: "Portal Wali", en: "Guardian Portal" },
  fallback: { id: "LMS", en: "LMS" },
} as const;

/** A single bilingual text pair. */
export interface TextPair {
  id: string;
  en: string;
}

/** Shape of every page/component dictionary. */
export type TextDict = Record<string, TextPair>;

/**
 * Typed per-page dictionary factory.
 *
 * `const t = mkT(DASH, lang)` — `t("key")` returns the string for the current
 * language, fully type-safe against `keyof DASH`. Intended for page-local
 * dictionaries (dictionary-per-page); shared chrome lives in NAV/EYEBROW/COMMON.
 */
export function mkT<D extends TextDict>(dict: D, lang: Lang): (key: keyof D) => string {
  return (key) => {
    const pair = dict[key] as TextPair | undefined;
    return (pair?.[lang] ?? pair?.id ?? String(key)) as string;
  };
}

/** BCP-47 locale used for number/date formatting of a UI language. */
export function localeFor(lang: Lang): string {
  return lang === "en" ? "en-US" : "id-ID";
}

/** Fill `{name}` placeholders in a translated template string. */
export function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined ? `{${k}}` : String(v);
  });
}

export const COMMON = {
  skipToContent: { id: "Lewati ke konten utama", en: "Skip to main content" },
  toggleTheme: { id: "Ganti tema terang/gelap", en: "Toggle light/dark theme" },
  openNav: { id: "Buka navigasi", en: "Open navigation" },
  closeNav: { id: "Tutup navigasi", en: "Close navigation" },
  signIn: { id: "Masuk", en: "Sign in" },
  password: { id: "Kata sandi", en: "Password" },
  email: { id: "Email", en: "Email" },
  signInHint: {
    id: "Gunakan akun sekolah yang diberikan oleh institusi Anda.",
    en: "Use the account provided by your school.",
  },
  signInChecking: { id: "Memeriksa…", en: "Checking…" },
  signInDone: { id: "Berhasil — mengalihkan…", en: "Signed in — redirecting…" },
  signInFailed: { id: "Login gagal. Coba lagi.", en: "Sign in failed. Please try again." },
  noAccess: { id: "Tidak punya akses", en: "No access" },
  noAccessBody: {
    id: "Akun Anda tidak memiliki peran yang dibutuhkan untuk halaman ini. Hubungi guru/admin sekolah bila ini keliru.",
    en: "Your account does not have the role required for this page. Contact your teacher or the school administrator if you believe this is a mistake.",
  },
  home: { id: "Beranda", en: "Home" },
  viewProfile: { id: "Lihat profil", en: "View profile" },
  accountInactive: { id: "Akun nonaktif", en: "Account inactive" },
  accountInactiveBody: {
    id: "Akun Anda berstatus nonaktif (ditangguhkan atau dinonaktifkan). Hubungi admin sekolah untuk pengaktifan kembali.",
    en: "Your account is inactive (suspended or disabled). Contact your school administrator to have it reactivated.",
  },
  backToSignIn: { id: "Kembali ke login", en: "Back to sign in" },
  somethingWrong: { id: "Terjadi kesalahan", en: "Something went wrong" },
  errorBody: {
    id: "Maaf, halaman tidak dapat dimuat. Coba muat ulang",
    en: "Sorry, this page could not be loaded. Try reloading",
  },
  reload: { id: "Muat ulang", en: "Reload" },
  pageNotFound: { id: "Halaman tidak ditemukan", en: "Page not found" },
  pageNotFoundBody: {
    id: "Alamat yang Anda tuju tidak ada atau sudah dipindahkan.",
    en: "The address you visited does not exist or has moved.",
  },
  backToLearning: { id: "Lanjutkan belajar", en: "Back to learning" },
  settings: { id: "Pengaturan", en: "Settings" },
  accountPrefs: { id: "Akun & preferensi", en: "Account & preferences" },
  myAccount: { id: "Akun saya", en: "My account" },
  displayName: { id: "Nama tampilan", en: "Display name" },
  roles: { id: "Peran", en: "Roles" },
  devicePrefs: { id: "Preferensi perangkat", en: "Device preferences" },
  devicePrefsBody: {
    id: "Tema dan ukuran teks tersimpan di perangkat ini (lokal).",
    en: "Theme and text size are stored on this device (local).",
  },
  uiLanguage: { id: "Bahasa antarmuka", en: "Interface language" },
  uiLanguageBody: {
    id: "Pilihan ini berlaku untuk seluruh menu di akun Anda.",
    en: "This choice applies to every menu in your account.",
  },
  languageIndonesian: { id: "Bahasa Indonesia", en: "Bahasa Indonesia" },
  languageEnglish: { id: "English", en: "English" },
  languageUpdated: { id: "Preferensi bahasa disimpan.", en: "Language preference saved." },
  settingsAria: { id: "Pengaturan", en: "Settings" },
  signOut: { id: "Keluar", en: "Sign out" },
  signOutBusy: { id: "Keluar…", en: "Signing out…" },
} as const;

export type DictKey = keyof typeof NAV | keyof typeof EYEBROW | keyof typeof COMMON;

/** Pick a language value from a `{ id, en }` pair. */
export function pick(pair: { id: string; en: string }, lang: Lang): string {
  return pair[lang];
}

/** Translate from the shared dictionaries. */
export function t(key: DictKey, lang: Lang): string {
  const inNav = (NAV as Record<string, { id: string; en: string }>)[key];
  if (inNav) return inNav[lang];
  const inEyebrow = (EYEBROW as Record<string, { id: string; en: string }>)[key];
  if (inEyebrow) return inEyebrow[lang];
  const inCommon = (COMMON as Record<string, { id: string; en: string }>)[key];
  if (inCommon) return inCommon[lang];
  return key;
}

/** Server-side: current user's language from their profile (fallback cookie, then default). */
export async function getLang(): Promise<Lang> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const cookie = store.get("lms-lang")?.value;
    if (isLang(cookie)) return cookie;
  } catch {
    // Non-request context (build/static) — fall through to default.
  }
  return DEFAULT_LANG;
}

/** Cookie name kept in sync with profiles.language (used by client-only shells). */
export const LANG_COOKIE = "lms-lang";
