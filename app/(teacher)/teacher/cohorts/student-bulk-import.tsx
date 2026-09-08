"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { bulkImportStudents } from "@/features/actions";
import { MAX_STUDENT_ROWS, xlsxFileError } from "@/lib/bulk-import";
import { BulkCard } from "@/components/bulk-card";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { COHORT } from "@/lib/ui-text/cohort";

interface ImportResult {
  ok: boolean;
  error?: string;
  cap?: number;
  added?: number;
  existing?: number;
  notFound?: string[];
  errors?: string[];
}

const ERROR_KEY: Record<string, keyof typeof COHORT> = {
  FILE_MUST_BE_XLSX: "errMustBeXlsx",
  FILE_EMPTY: "errEmpty",
  FILE_TOO_LARGE: "errTooLarge",
  FILE_MIME_REJECTED: "errMimeRejected",
};

function errorText(t: (k: keyof typeof COHORT) => string, err: string | undefined, cap?: number): string {
  if (!err) return "";
  if (err === "ROWS_OVER_CAP") return fmt(t("errRowsOverCap"), { cap: cap ?? MAX_STUDENT_ROWS });
  const key = ERROR_KEY[err];
  return key ? t(key) : err;
}

async function run(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  return (await bulkImportStudents(formData)) as ImportResult;
}

export function StudentBulkImport({
  cohorts,
  lang,
}: {
  cohorts: { id: string; name: string }[];
  lang: Lang;
}) {
  const t = mkT(COHORT, lang);
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
      lang={lang}
      title={t("bulkTitle")}
      desc={t("bulkDesc")}
      templateKind="students"
      templateLabel={t("bulkTemplateLabel")}
      exportHref={cohortSel ? `/api/export/cohorts/${cohortSel}/xlsx` : undefined}
      exportLabel={t("bulkExportLabel")}
      capacityText={fmt(t("bulkCapacity"), { max: MAX_STUDENT_ROWS })}
    >
      <form
        ref={formRef}
        action={formAction}
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={() => setClientErr(null)}
      >
        <div>
          <label htmlFor="bulk-cohort" className="text-sm font-semibold">
            {t("targetCohort")}
          </label>
          <select
            id="bulk-cohort"
            name="cohortId"
            required
            value={cohortSel}
            onChange={(e) => setCohortSel(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900"
          >
            <option value="">{t("selectCohort")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bulk-file" className="text-sm font-semibold">
            {t("fileLabel")}
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
          {pending ? t("processing") : t("importStudents")}
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
              <p>{fmt(t("doneSummary"), { added: result.added ?? 0, existing: result.existing ?? 0 })}</p>
              {result.notFound && result.notFound.length > 0 && (
                <p className="mt-1">
                  {fmt(t("notFound"), {
                    count: result.notFound.length,
                    list: result.notFound.slice(0, 5).join(", "),
                  })}
                  {result.notFound.length > 5 ? "…" : ""}
                </p>
              )}
              {result.errors && result.errors.length > 0 && (
                <p className="mt-1 text-xs">{result.errors.slice(0, 5).join("; ")}</p>
              )}
            </>
          ) : (
            <p>
              {fmt(t("failed"), { error: errorText(t, result.error, result.cap) })}
              {result.errors && result.errors.length > 0 ? ` — ${result.errors.slice(0, 3).join("; ")}` : ""}
            </p>
          )}
        </div>
      )}
    </BulkCard>
  );
}
