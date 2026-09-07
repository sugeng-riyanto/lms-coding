"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportTeachers } from "@/features/actions";
import { MAX_TEACHER_ROWS, xlsxFileError } from "@/lib/bulk-import";
import { BulkCard } from "@/components/bulk-card";

const ERR_TEXT: Record<string, string> = {
  FILE_MUST_BE_XLSX: "Berkas harus berformat .xlsx.",
  FILE_EMPTY: "Berkas kosong.",
  FILE_TOO_LARGE: "Berkas terlalu besar (maks 5 MB).",
  FILE_MIME_REJECTED: "Tipe berkas ditolak.",
  NO_VALID_ROWS: "Tidak ada baris valid di berkas.",
  ROWS_OVER_CAP: "Terlalu banyak baris guru.",
  FORBIDDEN: "Aksi ini hanya untuk admin org (guru pemilik course).",
  FILE_MISSING: "Berkas tidak ditemukan.",
};

export function TeacherBulkImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<React.ReactNode>(null);
  const [clientErr, setClientErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (file instanceof File) {
      const err = xlsxFileError(file);
      if (err) {
        setClientErr(ERR_TEXT[err] ?? err);
        return;
      }
    }
    setClientErr("");
    setBusy(true);
    const res = await bulkImportTeachers(fd);
    setBusy(false);
    if (res.ok) {
      const parts = [
        `${res.added} guru diproses`,
        res.classesCreated > 0 ? `${res.classesCreated} kelas baru dibuat` : null,
        res.notFound.length > 0 ? `${res.notFound.length} email tidak ditemukan` : null,
      ].filter(Boolean);
      setNotice(
        <span
          role="status"
          className="block rounded-xl bg-emerald-100 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {parts.join(" · ")}.
          {res.notFound.length > 0 && (
            <span className="block text-amber-700 dark:text-amber-300">
              Tidak ditemukan: {res.notFound.join(", ")}
            </span>
          )}
          {res.errors.length > 0 && (
            <span className="block text-amber-700 dark:text-amber-300">{res.errors.join(" ")}</span>
          )}
        </span>,
      );
      // Berkas dibuang setelah sukses (server tidak pernah menyimpannya).
      form.reset();
    } else {
      setNotice(
        <span
          role="status"
          className="block rounded-xl bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
        >
          Gagal: {ERR_TEXT[res.error] ?? res.error}
        </span>,
      );
    }
    router.refresh();
  }

  return (
    <BulkCard
      title="Bulk daftarkan guru (XLSX)"
      desc={
        <>
          Kolom: <code>Email</code>, <code>Nama</code>, opsional <code>Kelas</code> (pisah dengan ; atau , —
          kelas akan dibuat bila belum ada). Akun harus sudah ada; hanya peran guru yang dibuat.
        </>
      }
      templateKind="teachers"
      templateLabel="Template guru"
      capacityText={`Maksimal ${MAX_TEACHER_ROWS} guru per file`}
    >
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="teacher-bulk-file" className="text-sm font-semibold">
            Berkas XLSX
          </label>
          <input
            id="teacher-bulk-file"
            type="file"
            name="file"
            accept=".xlsx"
            required
            onChange={(e) => {
              const f = e.target.files?.[0];
              setClientErr(
                f ? (xlsxFileError(f) ? (ERR_TEXT[xlsxFileError(f) ?? "FILE_MISSING"] ?? "") : "") : "",
              );
            }}
            className="mt-1 block w-full text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Memproses…" : "Upload guru"}
        </button>
      </form>
      {clientErr && <p className="text-sm text-red-700">{clientErr}</p>}
      {notice}
    </BulkCard>
  );
}
