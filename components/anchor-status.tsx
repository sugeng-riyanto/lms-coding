import { fmt, mkT, type Lang } from "@/lib/i18n";
import { CERT } from "@/lib/ui-text/cert";

/** Status anchor blockchain per sertifikat (ADR-018) — teks selalu ada, warna
 * hanya pembeda sekunder. "Final" adalah satu-satunya state yang boleh
 * menyebut terverifikasi blockchain (ACCEPTANCE_CRITERIA). */
export function AnchorStatusChip({
  status,
  reference,
  lang = "id",
}: {
  status: string | null;
  reference?: string | null;
  lang?: Lang;
}) {
  const t = mkT(CERT, lang);
  if (!status || status === "none") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {t("chipNone")}
      </span>
    );
  }
  if (status === "final") {
    return (
      <span
        title={reference ? fmt(t("chipTxTitle"), { ref: reference }) : undefined}
        className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      >
        {t("chipFinal")}
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span
        title={reference ? fmt(t("chipTxTitle"), { ref: reference }) : undefined}
        className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      >
        {t("chipPending")}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-200">
        {t("chipFailed")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {status}
    </span>
  );
}
