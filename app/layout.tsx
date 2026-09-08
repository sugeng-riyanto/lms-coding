import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { isDemoBackend } from "@/lib/supabase/demo";
import { COMMON, getLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: {
    default: "Coding School LMS",
    template: "%s · Coding School LMS",
  },
  description:
    "School coding platform: structured learning paths, code boards, embedded media, quizzes, assessment, and verifiable certificates.",
};

/** Inisialisasi tema tanpa FOUC: localStorage dulu, fallback preferensi sistem. */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("lms-theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce CSP (proxy.ts → x-nonce) DIOPERKAN eksplisit ke script inline tema:
  // Next hanya memberi nonce otomatis ke script generasinya sendiri — script
  // buatan (dangerouslySetInnerHTML) wajib nonce manual agar lolos enforce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // Lang atribut mengikuti preferensi bahasa (profiles.language → cookie) agar
  // screen reader mengumumkan konten dengan locale yang benar (a11y).
  const lang = await getLang();
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {isDemoBackend() && (
          <p
            role="status"
            className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900"
          >
            Demo mode (dev) — local Supabase not detected. Pages show empty states without real data; sign in
            &amp; storage are disabled.
          </p>
        )}
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-yellow-200">
          {lang === "id" ? COMMON.skipToContent.id : COMMON.skipToContent.en}
        </a>
        {children}
      </body>
    </html>
  );
}
