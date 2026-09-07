"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { bulkImportStudents } from "@/features/actions";
import { MAX_STUDENT_ROWS, xlsxFileError } from "@/lib/bulk-import";
import { BulkCard } from "@/components/bulk-card";

interface ImportResult {
  ok: boolean;
  error?: string;
  cap?: number;
  added?: number;
  existing?: number;
  notFound?: string[];
  errors?: string[];
}

const ERROR_TEXT: Record<string, string> = {
  FILE_MUST_BE_XLSX: "Berkas harus berformat .xlsx.",
  FILE_EMPTY: "Berkas kosong (0 byte).",
  FILE_TOO_LARGE: "Berkas melebihi batas ukuran 5 MB.",
  FILE_MIME_REJECTED: "Jenis berkas tidak dikenali sebagai spreadsheet.",
};

function errorText(err: string | undefined, cap?: number): string {
  if (!err) return "";
  if (err === "ROWS_OVER_CAP")
    return `File melebihi batas ${cap ?? MAX_STUDENT_ROWS} baris valid. Pecah menjadi beberapa file.`;
  return ERROR_TEXT[err] ?? err;
}

async function run(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  return (await bulkImportStudents(formData)) as ImportResult;
}

export function StudentBulkImport({ cohorts }: { cohorts: { id: string; name: string }[] }) {
  const [result, formAction, pending] = useActionState(run, null);
  const [clientErr, setClientErr] = useState<string | null>(null);
  const [cohortSel, setCohortSel] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Berkas dibuang setelah sukses: reset form (server tidak pernah menyimpan
  // file — parse di memori lalu Buffer dibebaskan).
  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <BulkCard
      title="Bulk daftarkan murid (XLSX)"
      desc={
        <>
          Kolom: <code>Email</code> (wajib) dan <code>Nama</code> (opsional). Murid dicocokkan berdasarkan
          email akun yang sudah ada; profil &amp; membership dibuat otomatis oleh server.
        </>
      }
      templateKind="students"
      templateLabel="Template murid"
      exportHref={cohortSel ? `/api/export/cohorts/${cohortSel}/xlsx` : undefined}
      exportLabel="Unduh roster cohort (XLSX)"
      capacityText={`Maksimal ${MAX_STUDENT_ROWS} murid per file`}
    >
      <form
        ref={formRef}
        action={formAction}
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={() => setClientErr(null)}
      >
        <div>
          <label htmlFor="bulk-cohort" className="text-sm font-semibold">
            Cohort tujuan
          </label>
          <select
            id="bulk-cohort"
            name="cohortId"
            required
            value={cohortSel}
            onChange={(e) => setCohortSel(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900"
          >
            <option value="">— pilih cohort —</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bulk-file" className="text-sm font-semibold">
            Berkas XLSX
          </label>
          <input
            id="bulk-file"
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="mt-1 block w-full text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setClientErr(f ? (xlsxFileError(f) ? errorText(xlsxFileError(f) ?? undefined) : null) : null);
            }}
          />
        </div>
        <button
          disabled={pending}
          className="rounded-xl bg-blue-700 px-5 py-2 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Memproses…" : "Impor murid"}
        </button>
      </form>
      {clientErr && <p className="text-sm font-medium text-red-700">{clientErr}</p>}
      {result && (
        <div
          role="status"
          className={`rounded-xl p-3 text-sm ${
            result.ok
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {result.ok ? (
            <>
              <p>
                Selesai: <strong>{result.added}</strong> ditambahkan, <strong>{result.existing}</strong> sudah
                menjadi anggota.
              </p>
              {result.notFound && result.notFound.length > 0 && (
                <p className="mt-1">
                  Email tidak ditemukan ({result.notFound.length}): {result.notFound.slice(0, 5).join(", ")}
                  {result.notFound.length > 5 ? "…" : ""}
                </p>
              )}
              {result.errors && result.errors.length > 0 && (
                <p className="mt-1 text-xs">{result.errors.slice(0, 5).join("; ")}</p>
              )}
            </>
          ) : (
            <p>
              Gagal: {errorText(result.error, result.cap)}
              {result.errors && result.errors.length > 0 ? ` — ${result.errors.slice(0, 3).join("; ")}` : ""}
            </p>
          )}
        </div>
      )}
    </BulkCard>
  );
}
