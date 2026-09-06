import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-blue-700">Coding School LMS</p>
        <ThemeToggle />
      </div>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">
        Belajar coding secara mandiri, terpantau guru, dan terbukti lewat sertifikat.
      </h1>
      <p className="mt-4 text-lg text-slate-600">
        Setiap murid memiliki jalur belajar personal, materi pemrograman dengan coding board serta media
        ter-embed, kuis dengan penilaian objektif, dan sertifikat yang dapat diverifikasi. Guru memantau
        penguasaan materi dan risiko ketertinggalan melalui dasbor kelas.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
        >
          Masuk
        </Link>
        <Link
          href="/learn"
          className="rounded-lg border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50"
        >
          Demo belajar murid
        </Link>
        <Link
          href="/teacher"
          className="rounded-lg border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50"
        >
          Dashboard guru
        </Link>
        <Link
          href="/guardian"
          className="rounded-lg border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50"
        >
          Ringkasan wali
        </Link>
      </div>
      <section aria-label="Status MVP" className="mt-12 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">Status MVP</h2>
        <ul className="mt-2 list-disc pl-5 text-slate-700">
          <li>Course → Level → Lesson → Activity → Assessment (versioned)</li>
          <li>Resume &amp; autosave pulih setelah refresh (offline retry queue)</li>
          <li>Attempt append-only, idempotent, grading server-side</li>
          <li>QR verifier publik minimal-PII + revocation</li>
        </ul>
      </section>
    </main>
  );
}
