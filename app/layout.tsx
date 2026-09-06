import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autonomous Learning LMS",
  description: "LMS personal: jalur belajar mandiri, mastery, kuis, dan sertifikat terverifikasi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-yellow-200">
          Lewati ke konten utama
        </a>
        {children}
      </body>
    </html>
  );
}
