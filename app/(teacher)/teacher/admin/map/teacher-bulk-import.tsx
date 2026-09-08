"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportTeachers } from "@/features/actions";
import { MAX_TEACHER_ROWS, xlsxFileError } from "@/lib/bulk-import";
import { BulkCard } from "@/components/bulk-card";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { ADMIN_MAP } from "@/lib/ui-text/admin-map";

const ERR_KEY: Record<string, keyof typeof ADMIN_MAP> = {
  FILE_MUST_BE_XLSX: "bulkErrMustBeXlsx",
  FILE_EMPTY: "bulkErrEmpty",
  FILE_TOO_LARGE: "bulkErrTooLarge",
  FILE_MIME_REJECTED: "bulkErrMime",
  NO_VALID_ROWS: "bulkErrNoValidRows",
  ROWS_OVER_CAP: "bulkErrRowsOverCap",
  FORBIDDEN: "errForbidden",
  FILE_MISSING: "bulkErrMissing",
};

export function TeacherBulkImport({ lang }: { lang: Lang }) {
  const t = mkT(ADMIN_MAP, lang);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<React.ReactNode>(null);
  const [clientErr, setClientErr] = useState("");

  function errText(err: string): string {
    const key = ERR_KEY[err];
    return key ? t(key) : err;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (file instanceof File) {
      const err = xlsxFileError(file);
      if (err) {
        setClientErr(errText(err));
        return;
      }
    }
    setClientErr("");
    setBusy(true);
    const res = await bulkImportTeachers(fd);
    setBusy(false);
    if (res.ok) {
      const parts = [
        fmt(t("teachersProcessed"), { count: res.added }),
        res.classesCreated > 0 ? fmt(t("classesCreated"), { count: res.classesCreated }) : null,
        res.notFound.length > 0 ? fmt(t("emailsNotFound"), { count: res.notFound.length }) : null,
      ].filter(Boolean);
      setNotice(
        <span
          role="status"
          className="block rounded-xl bg-emerald-100 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {parts.join(" · ")}.
          {res.notFound.length > 0 && (
            <span className="block text-amber-700 dark:text-amber-300">
              {fmt(t("notFoundList"), { list: res.notFound.join(", ") })}
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
          {fmt(t("failPrefix"), { error: errText(res.error) })}
        </span>,
      );
    }
    router.refresh();
  }

  return (
    <BulkCard
      lang={lang}
      title={t("teacherBulkTitle")}
      desc={t("teacherBulkDesc")}
      templateKind="teachers"
      templateLabel={t("teacherBulkTemplate")}
      capacityText={fmt(t("teacherBulkCapacity"), { max: MAX_TEACHER_ROWS })}
    >
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="teacher-bulk-file" className="text-sm font-semibold">
            {t("fileLabel")}
          </label>
          <input
            id="teacher-bulk-file"
            type="file"
            name="file"
            accept=".xlsx"
            required
            onChange={(e) => {
              const f = e.target.files?.[0];
              setClientErr(f ? (xlsxFileError(f) ? errText(xlsxFileError(f) ?? "FILE_MISSING") : "") : "");
            }}
            className="mt-1 block w-full text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? t("processing") : t("uploadTeacher")}
        </button>
      </form>
      {clientErr && <p className="text-sm text-red-700">{clientErr}</p>}
      {notice}
    </BulkCard>
  );
}
