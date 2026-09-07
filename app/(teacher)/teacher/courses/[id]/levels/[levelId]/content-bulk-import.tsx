"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { bulkImportContent } from "@/features/actions";
import { MAX_CONTENT_ROWS, xlsxFileError } from "@/lib/bulk-import";
import { BulkCard } from "@/components/bulk-card";

interface ImportResult {
  ok: boolean;
  error?: string;
  cap?: number;
  modules?: number;
  lessons?: number;
  activities?: number;
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
    return `File melebihi batas ${cap ?? MAX_CONTENT_ROWS} baris valid. Pecah menjadi beberapa file.`;
  return ERROR_TEXT[err] ?? err;
}

async function run(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  return (await bulkImportContent(formData)) as ImportResult;
}

export function ContentBulkImport({ courseId, levelId }: { courseId: string; levelId: string }) {
  const [result, formAction, pending] = useActionState(run, null);
  const [clientErr, setClientErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Berkas dibuang setelah sukses: reset form (server tidak pernah menyimpan file).
  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <BulkCard
      title="Bulk impor materi (XLSX)"
      desc={
        <>
          Kolom: <code>Module</code>, <code>Lesson</code>, <code>Objective</code> (opsional),{" "}
          <code>Activity Type</code>, <code>Activity Title</code>, <code>Content JSON</code> (opsional).
          Materi masuk ke level ini sebagai draf.
        </>
      }
      templateKind="content"
      templateLabel="Template materi"
      exportHref={`/api/export/courses/${courseId}/xlsx`}
      exportLabel="Unduh materi kursus (XLSX)"
      capacityText={`Maksimal ${MAX_CONTENT_ROWS} baris per file`}
    >
      <form
        ref={formRef}
        action={formAction}
        className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={() => setClientErr(null)}
      >
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="levelId" value={levelId} />
        <div>
          <label htmlFor="content-bulk-file" className="text-sm font-semibold">
            Berkas XLSX
          </label>
          <input
            id="content-bulk-file"
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
          {pending ? "Memproses…" : "Impor materi"}
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
                Selesai: <strong>{result.modules}</strong> module, <strong>{result.lessons}</strong> lesson,{" "}
                <strong>{result.activities}</strong> aktivitas.
              </p>
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
