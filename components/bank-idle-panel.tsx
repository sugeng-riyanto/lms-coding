"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mkT, type Lang } from "@/lib/i18n";
import { DASH } from "@/lib/ui-text/dash";

export interface BankRow {
  id: string;
  type: string;
  prompt: string;
  difficulty: string;
  key: string;
  used: boolean;
  courseSlug: string | null;
}

/** Map question-pack type alias for a single-row pack string. */
const TYPE_ALIAS: Record<string, string> = {
  single_choice: "sc",
  multiple_choice: "mc",
  true_false: "tf",
  essay_manual: "essay",
  numeric_tolerance: "numeric",
  short_text: "short",
  file_manual: "file",
};

/** Build a single question-pack line from a bank row. */
function rowToPackLine(r: BankRow): string {
  const alias = TYPE_ALIAS[r.type] ?? r.type;
  // sc | prompt | | | | | key | 10 | reused
  return [alias, r.prompt, "", "", "", "", r.key, "10", "reused from demo bank"].join(" | ");
}

export function BankIdlePanel({
  rows,
  lang,
}: {
  rows: BankRow[];
  lang: Lang;
}) {
  const t = mkT(DASH, lang);
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyKey(r: BankRow) {
    if (!r.key) return;
    try {
      await navigator.clipboard.writeText(r.key);
      setCopiedId(r.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      /* clipboard API not available — silent no-op */
    }
  }

  function reuse(r: BankRow) {
    const line = rowToPackLine(r);
    router.push(`/teacher/questions?pack=${encodeURIComponent(line)}`);
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border bg-white shadow-sm dark:bg-slate-900">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2">{t("bankColQuestion")}</th>
            <th className="p-2">{t("bankColCourse")}</th>
            <th className="p-2">{t("bankColType")}</th>
            <th className="p-2">{t("bankColDifficulty")}</th>
            <th className="p-2">{t("bankColKey")}</th>
            <th className="p-2">{t("bankColStatus")}</th>
            <th className="p-2">{t("bankActions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b align-top">
              <td className="max-w-[16rem] p-2 font-medium" title={r.prompt}>
                {r.prompt.length > 64 ? r.prompt.slice(0, 63) + "…" : r.prompt}
              </td>
              <td className="p-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.courseSlug === "kimia-dasar-demo"
                      ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"
                      : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                  }`}
                >
                  {r.courseSlug === "kimia-dasar-demo" ? t("bankCourseChem") : t("bankCourseMath")}
                </span>
              </td>
              <td className="p-2 text-slate-600 dark:text-slate-300">
                {({
                  single_choice: t("bankTypeSingleChoice"),
                  true_false: t("bankTypeTrueFalse"),
                  multiple_choice: t("bankTypeMultipleChoice"),
                  numeric_tolerance: t("bankTypeNumeric"),
                  short_text: t("bankTypeShortText"),
                  essay_manual: t("bankTypeEssay"),
                  file_manual: t("bankTypeFile"),
                }[r.type] ?? r.type)}
              </td>
              <td className="p-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    {
                      easy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                      medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                      hard: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                    }[r.difficulty] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {({ easy: t("bankDiffEasy"), medium: t("bankDiffMedium"), hard: t("bankDiffHard") }[
                    r.difficulty
                  ] ?? r.difficulty)}
                </span>
              </td>
              <td className="max-w-[14rem] p-2 font-mono text-xs" title={r.key ? r.key : undefined}>
                {r.key ? (r.key.length > 36 ? r.key.slice(0, 35) + "…" : r.key) : t("bankKeyManual")}
              </td>
              <td className="p-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.used
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {r.used ? t("bankStatusUsed") : t("bankStatusIdle")}
                </span>
              </td>
              <td className="whitespace-nowrap p-2">
                <div className="flex gap-1.5">
                  {!r.used && r.key && (
                    <button
                      type="button"
                      onClick={() => copyKey(r)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      title={t("bankCopyKey")}
                    >
                      {copiedId === r.id ? t("bankCopied") : t("bankCopyKey")}
                    </button>
                  )}
                  {!r.used && (
                    <button
                      type="button"
                      onClick={() => reuse(r)}
                      className="rounded-lg bg-blue-700 px-2 py-1 text-xs font-semibold text-white transition hover:bg-blue-800"
                    >
                      {t("bankReuse")}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
