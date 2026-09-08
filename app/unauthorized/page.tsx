import Link from "next/link";
import { COMMON, getLang } from "@/lib/i18n";

// Nonce CSP (lib/csp.ts) memerlukan dynamic rendering.
export const dynamic = "force-dynamic";

export default async function UnauthorizedPage() {
  const lang = await getLang();
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">{COMMON.noAccess[lang]}</h1>
      <p className="mt-2 text-slate-600">{COMMON.noAccessBody[lang]}</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800"
        >
          {COMMON.home[lang]}
        </Link>
        <Link href="/profile" className="rounded-lg border px-5 py-2 font-semibold hover:bg-slate-50">
          {COMMON.viewProfile[lang]}
        </Link>
      </div>
    </main>
  );
}
