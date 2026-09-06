import Link from "next/link";
import { NewCourseForm } from "./new-course-form";

export default function NewCoursePage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/teacher" className="text-sm text-blue-700 underline">
        ← Dashboard guru
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Buat course baru</h1>
      <p className="mt-2 text-slate-600">
        Draft tersimpan sebagai versi 1. Konten yang sudah dipakai attempt tidak diedit in-place — publish
        membuat validasi server-side; perubahan berikutnya membuat versi baru.
      </p>
      <NewCourseForm />
    </main>
  );
}
