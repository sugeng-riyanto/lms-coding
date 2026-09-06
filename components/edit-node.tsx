"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteContent, updateContent } from "@/features/actions";

type Table = "levels" | "modules" | "lessons" | "activities";

/** Edit judul/objective + hapus node konten (draft-only, guard server ADR-003). */
export function EditNode({
  table,
  id,
  initialTitle,
  initialObjective,
  showObjective,
}: {
  table: Table;
  id: string;
  initialTitle: string;
  initialObjective?: string;
  showObjective?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [objective, setObjective] = useState(initialObjective ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await updateContent({
      table,
      id,
      title,
      objective: showObjective === true ? objective : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(
        res.error === "PUBLISHED_IMMUTABLE"
          ? "Versi published tidak bisa diubah — buat versi baru."
          : `Gagal: ${res.error}`,
      );
    } else {
      setOpen(false);
      router.refresh();
    }
  }

  async function onDelete() {
    if (!window.confirm("Hapus item ini beserta isinya?")) return;
    setBusy(true);
    setError("");
    const res = await deleteContent({ table, id });
    setBusy(false);
    if (!res.ok) {
      setError(
        res.error === "PUBLISHED_IMMUTABLE"
          ? "Versi published tidak bisa dihapus."
          : res.error === "HAS_ATTEMPTS"
            ? "Sudah ada attempt — tidak bisa dihapus (auditability)."
            : `Gagal: ${res.error}`,
      );
    } else {
      router.refresh();
    }
  }

  if (!open) {
    return (
      <span className="flex gap-1">
        <button
          onClick={() => setOpen(true)}
          aria-label={`Ubah ${initialTitle}`}
          className="rounded border px-2 py-1 text-xs"
        >
          Ubah
        </button>
        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={`Hapus ${initialTitle}`}
          className="rounded border px-2 py-1 text-xs text-red-700 disabled:opacity-40"
        >
          Hapus
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={onSave} className="mt-2 rounded border bg-white p-2">
      <label className="block text-xs font-semibold">
        Judul
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={200}
          className="mt-1 block w-full rounded border px-2 py-1 text-sm"
        />
      </label>
      {showObjective === true && (
        <label className="mt-1 block text-xs font-semibold">
          Objective
          <input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            required
            minLength={10}
            maxLength={2000}
            className="mt-1 block w-full rounded border px-2 py-1 text-sm"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
      <span className="mt-2 flex gap-1">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          Simpan
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border px-2 py-1 text-xs">
          Batal
        </button>
      </span>
    </form>
  );
}
