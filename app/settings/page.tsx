import { requireActiveMembership } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { navForRole } from "@/lib/role-nav";
import { getOrgAdminContext } from "@/lib/org-admin";
import { FontScaleControl } from "@/app/(student)/font-scale";
import { EYEBROW, getLang, pick, COMMON } from "@/lib/i18n";
import { LanguageToggle } from "@/components/language-toggle";

export const dynamic = "force-dynamic";

const EYEBROW_KEY: Record<string, keyof typeof EYEBROW> = {
  student: "student",
  teacher: "teacher",
  guardian: "guardian",
};

/**
 * Pengaturan milik-sendiri untuk SEMUA peran (RBAC.md: bukan kapabilitas
 * khusus — setiap pengguna terautentikasi mengelola akunnya sendiri).
 * Konten menyesuaikan peran; authz tetap guard membership aktif.
 */
export default async function SettingsPage() {
  const identity = await requireActiveMembership(["student", "teacher", "guardian"]);
  const isAdmin = identity.role === "teacher" ? (await getOrgAdminContext()) !== null : false;
  const lang = await getLang();
  const nav = navForRole(identity.role, isAdmin, lang);
  const eyebrowKey = EYEBROW_KEY[identity.role] ?? "fallback";

  return (
    <AppShell eyebrow={pick(EYEBROW[eyebrowKey], lang)} nav={nav}>
      <main id="main" className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
          {COMMON.settings[lang]}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{COMMON.accountPrefs[lang]}</h1>
        <div className="mt-6">
          <SettingsPanel lang={lang}>
            {identity.role === "student" && (
              <span className="inline-flex items-center gap-2 text-sm">
                {lang === "id" ? "Ukuran teks:" : "Text size:"} <FontScaleControl />
              </span>
            )}
            <section
              aria-label={COMMON.uiLanguage[lang]}
              className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900"
            >
              <h2 className="font-bold">{COMMON.uiLanguage[lang]}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{COMMON.uiLanguageBody[lang]}</p>
              <div className="mt-3">
                <LanguageToggle current={lang} />
              </div>
            </section>
          </SettingsPanel>
        </div>
      </main>
    </AppShell>
  );
}
