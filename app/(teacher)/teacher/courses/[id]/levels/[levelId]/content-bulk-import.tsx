"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { bulkImportContent } from "@/features/actions";
import { MAX_CONTENT_ROWS, xlsxFileError } from "@/lib/bulk-import";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { LEVEL } from "@/lib/ui-text/level";
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

function errorText(t: (k: keyof typeof LEVEL) => string, err: string | undefined, cap?: number): string {
  if (!err) return "";
  if (err === "ROWS_OVER_CAP") return fmt(t("rowsOverCap"), { cap: cap ?? MAX_CONTENT_ROWS });
  const map: Record<string, keyof typeof LEVEL> = {
    FILE_MUST_BE_XLSX: "fileMustBeXlsx",
    FILE_EMPTY: "fileEmpty",
    FILE_TOO_LARGE: "fileTooLarge",
    FILE_MIME_REJECTED: "fileMimeRejected",
  };
  const key = map[err];
  return key ? t(key) : err;
}

async function run(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  return (await bulkImportContent(formData)) as ImportResult;
}

export function ContentBulkImport({
  courseId,
  levelId,
  lang,
}: {
  courseId: string;
  levelId: string;
  lang: Lang;
}) {
  const t = mkT(LEVEL, lang);
  const [result, formAction, pending] = useActionState(run, null);
  const [clientErr, setClientErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Berkas dibuang setelah sukses: reset form (server tidak pernah menyimpan file).
  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <BulkCard
      lang={lang}
      title={t("bulkTitle")}
      desc={t("bulkDesc")}
      templateKind="content"
      templateLabel={t("templateLabel")}
      exportHref={`/api/export/courses/${courseId}/xlsx`}
      exportLabel={t("exportLabel")}
      capacityText={fmt(t("capacityText"), { n: MAX_CONTENT_ROWS })}
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
            {t("fileLabel")}
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
              setClientErr(
                f ? (xlsxFileError(f) ? errorText(t, xlsxFileError(f) ?? undefined) : null) : null,
              );
            }}
          />
        </div>
        <button
          disabled={pending}
          className="rounded-xl bg-blue-700 px-5 py-2 font-semibold text-white disabled:opacity-60"
        >
          {pending ? t("processing") : t("importButton")}
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
                {fmt(t("importDone"), {
                  modules: result.modules ?? 0,
                  lessons: result.lessons ?? 0,
                  activities: result.activities ?? 0,
                })}
              </p>
              {result.errors && result.errors.length > 0 && (
                <p className="mt-1 text-xs">{result.errors.slice(0, 5).join("; ")}</p>
              )}
            </>
          ) : (
            <p>
              {fmt(t("importFailed"), { error: errorText(t, result.error, result.cap) })}
              {result.errors && result.errors.length > 0 ? ` — ${result.errors.slice(0, 3).join("; ")}` : ""}
            </p>
          )}
        </div>
      )}
    </BulkCard>
  );
}
