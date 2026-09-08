import Link from "next/link";
import { COMMON, getLang } from "@/lib/i18n";

// Nonce CSP (lib/csp.ts) memerlukan dynamic rendering.
export const dynamic = "force-dynamic";

export default async function AccountInactivePage() {
  const lang = await getLang();
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">{COMMON.accountInactive[lang]}</h1>
      <p className="mt-2 text-slate-600" role="status">
        {COMMON.accountInactiveBody[lang]}
      </p>
      <div className="mt-6">
        <Link href="/login" className="rounded-lg border px-5 py-2 font-semibold hover:bg-slate-50">
          {COMMON.backToSignIn[lang]}
        </Link>
      </div>
    </main>
  );
}
