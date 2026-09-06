import type { Metadata } from "next";
import "./globals.css";
import { isDemoBackend } from "@/lib/supabase/demo";

export const metadata: Metadata = {
  title: "Autonomous Learning LMS",
  description: "LMS personal: jalur belajar mandiri, mastery, kuis, dan sertifikat terverifikasi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
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
