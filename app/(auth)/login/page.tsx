// Nonce CSP (lib/csp.ts) memerlukan dynamic rendering agar inline scripts
// halaman login ikut diberi nonce — route segment config tidak boleh di
// file "use client", jadi halaman ini server component tipis.
export const dynamic = "force-dynamic";

import { LoginForm } from "./login-form";
import { isLang, type Lang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { LANG_COOKIE } from "@/lib/i18n";

/** Default English — the pilot is English-first until a user picks otherwise. */
const DEFAULT_LOGIN_LANG: Lang = "en";

/**
 * Bahasa untuk layar login (pre-auth). Pengunjung anonim memakai pilihan
 * cookie `lms-lang` (dipilih di halaman login itu sendiri). Jika sudah ada
 * session (kembali ke login dengan sesi hidup / baru login), preferensi dari
 * `profiles.language` (server-controlled) MENANG — cookie pengunjung hanya
 * cermin, bukan sumber kebenaran. Gagal apa pun (env demo, offline) → default.
 */
async function resolveLoginLang(): Promise<Lang> {
  let cookieLang: Lang | undefined;
  try {
    const store = await cookies();
    const v = store.get(LANG_COOKIE)?.value;
    if (isLang(v)) cookieLang = v;
  } catch {
    // Non-request context — fall through to default.
  }

  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
    if (userId) {
      const { data } = await supabase.from("profiles").select("language").eq("id", userId).maybeSingle();
      const profileLang = (data as { language?: unknown } | null)?.language;
      if (isLang(profileLang)) return profileLang;
    }
  } catch {
    // Demo/offline — cookie choice still respected below.
  }

  return cookieLang ?? DEFAULT_LOGIN_LANG;
}

export default async function LoginPage() {
  const lang = await resolveLoginLang();
  return <LoginForm lang={lang} />;
}
