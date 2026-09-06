import type { Metadata } from "next";
import "./globals.css";
import { isDemoBackend } from "@/lib/supabase/demo";

export const metadata: Metadata = {
  title: {
    default: "Coding School LMS",
    template: "%s · Coding School LMS",
  },
  description:
    "Platform pembelajaran coding sekolah: jalur belajar terstruktur, coding board, materi ter-embed, kuis, penilaian, dan sertifikat terverifikasi.",
};

/** Inisialisasi tema tanpa FOUC: localStorage dulu, fallback preferensi sistem. */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("lms-theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {isDemoBackend() && (
          <p
            role="status"
            className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900"
          >
            Mode demo (dev) — Supabase lokal tidak terdeteksi. Halaman menampilkan state kosong tanpa data
            nyata; login &amp; penyimpanan nonaktif.
          </p>
        )}
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-yellow-200">
          Lewati ke konten utama
        </a>
        {children}
      </body>
    </html>
  );
}
