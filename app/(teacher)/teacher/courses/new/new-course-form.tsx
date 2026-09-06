"use client";

import { useState } from "react";
import { createCourse } from "@/features/actions";

export function NewCourseForm() {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const res = await createCourse({ slug, title, description });
    if (res.ok) {
      setStatus("done");
      setMessage(
        `Draft dibuat (course ${res.courseId}, versi 1). Tambahkan level via database/authoring lanjutan, lalu publish.`,
      );
    } else {
      setStatus("error");
      setMessage(
        res.error === "FORBIDDEN" ? "Hanya guru aktif yang bisa membuat course." : `Gagal: ${res.error}`,
      );
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Form course baru"
      className="mt-6 max-w-xl space-y-4 rounded-xl border p-5"
    >
      <div>
        <label htmlFor="slug" className="font-semibold">
          Slug (huruf kecil, angka, strip)
        </label>
        <input
          id="slug"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          pattern="[a-z0-9-]+"
          minLength={3}
          maxLength={80}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="matematika-dasar"
        />
      </div>
      <div>
        <label htmlFor="title" className="font-semibold">
          Judul
        </label>
        <input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          minLength={3}
          maxLength={200}
          className="mt-1 w-full rounded-lg border px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="desc" className="font-semibold">
          Deskripsi
        </label>
        <textarea
          id="desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          className="mt-1 w-full rounded-lg border px-3 py-2"
        />
      </div>
      {status === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
          {message}
        </p>
      )}
      {status === "done" && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white disabled:opacity-60"
      >
        {status === "loading" ? "Menyimpan…" : "Buat draft"}
      </button>
    </form>
  );
}
