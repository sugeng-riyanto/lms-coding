// Nonce CSP (lib/csp.ts) memerlukan dynamic rendering agar inline scripts
// halaman login ikut diberi nonce — route segment config tidak boleh di
// file "use client", jadi halaman ini server component tipis.
export const dynamic = "force-dynamic";

import { LoginForm } from "./login-form";
import { getLang } from "@/lib/i18n";

export default async function LoginPage() {
  const lang = await getLang();
  return <LoginForm lang={lang} />;
}
