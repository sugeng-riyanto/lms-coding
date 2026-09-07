"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportTeachers } from "@/features/actions";
import { xlsxFileError } from "@/lib/bulk-import";

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
    const fd = new FormData(e.currentTarget);
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
        <span role="status" className="mt-2 block text-sm">
          {parts.join(" · ")}.
          {res.notFound.length > 0 && (
            <span className="block text-amber-700">Tidak ditemukan: {res.notFound.join(", ")}</span>
          )}
          {res.errors.length > 0 && <span className="block text-amber-700">{res.errors.join(" ")}</span>}
        </span>,
      );
    } else {
      setNotice(
        <span role="status" className="mt-2 block text-sm text-red-700">
          Gagal: {ERR_TEXT[res.error] ?? res.error}
        </span>,
      );
    }
    router.refresh();
  }

  return (
    <section aria-label="Bulk upload guru" className="rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Bulk daftarkan guru (XLSX)</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Kolom: <code className="font-mono text-xs">Email</code>,{" "}
        <code className="font-mono text-xs">Nama</code>, opsional{" "}
        <code className="font-mono text-xs">Kelas</code> (pisah dengan ; atau , — kelas akan dibuat bila belum
        ada). Akun harus sudah ada; hanya peran guru yang dibuat.
      </p>
      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        <input
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
          className="block w-full text-sm"
        />
        {clientErr && <p className="text-sm text-red-700">{clientErr}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Memproses…" : "Upload guru"}
        </button>
        {notice}
      </form>
    </section>
  );
}
