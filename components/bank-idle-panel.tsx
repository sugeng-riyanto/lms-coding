"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { DASH } from "@/lib/ui-text/dash";

export interface BankRow {
  id: string;
  type: string;
  prompt: string;
  difficulty: string;
  key: string;
  used: boolean;
  courseSlug: string | null;
  linkedAt: string | null;
}

const PAGE_SIZE = 20;

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

function rowToPackLine(r: BankRow): string {
  const alias = TYPE_ALIAS[r.type] ?? r.type;
  return [alias, r.prompt, "", "", "", "", r.key, "10", "reused from demo bank"].join(" | ");
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
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

  // Filter state
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [diffFilter, setDiffFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Unique values for dropdowns
  const types = useMemo(() => unique(rows.map((r) => r.type)).sort(), [rows]);
  const difficulties = useMemo(() => unique(rows.map((r) => r.difficulty)).sort(), [rows]);
  const courses = useMemo(() => unique(rows.map((r) => r.courseSlug ?? "")).sort(), [rows]);

  // Filter + search
  const filtered = useMemo(() => {
    let out = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.prompt.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
    }
    if (typeFilter) out = out.filter((r) => r.type === typeFilter);
    if (diffFilter) out = out.filter((r) => r.difficulty === diffFilter);
    if (courseFilter) out = out.filter((r) => (r.courseSlug ?? "") === courseFilter);
    if (statusFilter === "used") out = out.filter((r) => r.used);
    if (statusFilter === "idle") out = out.filter((r) => !r.used);
    return out;
  }, [rows, search, typeFilter, diffFilter, courseFilter, statusFilter]);

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function copyKey(r: BankRow) {
    if (!r.key) return;
    navigator.clipboard.writeText(r.key).then(() => {
      setCopiedId(r.id);
      setTimeout(() => setCopiedId(null), 1800);
    }).catch(() => {});
  }

  function reuse(r: BankRow) {
    router.push(`/teacher/questions?pack=${encodeURIComponent(rowToPackLine(r))}`);
  }

  function resetFilters() {
    setSearch("");
    setTypeFilter("");
    setDiffFilter("");
    setCourseFilter("");
    setStatusFilter("");
    setPage(1);
  }

  const hasFilters = search || typeFilter || diffFilter || courseFilter || statusFilter;

  // ── Filter bar ──
  const selectCls =
    "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <div className="mt-3 rounded-2xl border bg-white shadow-sm dark:bg-slate-900">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-end gap-2 border-b p-3">
        {/* Search */}
        <div className="flex-1 min-w-[10rem]">
          <label htmlFor="bank-search" className="mb-0.5 block text-xs font-medium text-slate-500">
            {t("bankColQuestion")}
          </label>
          <input
            id="bank-search"
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("bankFilterPlaceholder")}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>

        {/* Type */}
        <div>
          <label htmlFor="bank-type" className="mb-0.5 block text-xs font-medium text-slate-500">
            {t("bankColType")}
          </label>
          <select
            id="bank-type"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className={selectCls}
          >
            <option value="">{t("bankFilterType")}</option>
            {types.map((tp) => (
              <option key={tp} value={tp}>
                {{ single_choice: t("bankTypeSingleChoice"), true_false: t("bankTypeTrueFalse"),
                   multiple_choice: t("bankTypeMultipleChoice"), numeric_tolerance: t("bankTypeNumeric"),
                   short_text: t("bankTypeShortText"), essay_manual: t("bankTypeEssay"),
                   file_manual: t("bankTypeFile"),
                }[tp] ?? tp}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label htmlFor="bank-diff" className="mb-0.5 block text-xs font-medium text-slate-500">
            {t("bankColDifficulty")}
          </label>
          <select
            id="bank-diff"
            value={diffFilter}
            onChange={(e) => { setDiffFilter(e.target.value); setPage(1); }}
            className={selectCls}
          >
            <option value="">{t("bankFilterDifficulty")}</option>
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {{ easy: t("bankDiffEasy"), medium: t("bankDiffMedium"), hard: t("bankDiffHard") }[d] ?? d}
              </option>
            ))}
          </select>
        </div>

        {/* Course */}
        <div>
          <label htmlFor="bank-course" className="mb-0.5 block text-xs font-medium text-slate-500">
            {t("bankColCourse")}
          </label>
          <select
            id="bank-course"
            value={courseFilter}
            onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
            className={selectCls}
          >
            <option value="">{t("bankFilterCourse")}</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c === "kimia-dasar-demo" ? t("bankCourseChem") : c === "matematika-numerik-demo" ? t("bankCourseMath") : c === "python-review-demo" ? t("bankCoursePython") : c || "—"}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="bank-status" className="mb-0.5 block text-xs font-medium text-slate-500">
            {t("bankColStatus")}
          </label>
          <select
            id="bank-status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className={selectCls}
          >
            <option value="">{t("bankFilterStatusAll")}</option>
            <option value="used">{t("bankFilterUsed")}</option>
            <option value="idle">{t("bankFilterIdle")}</option>
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Results count ── */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500">
        <span>{fmt(t("bankResults"), { n: filtered.length })}</span>
        {totalPages > 1 && (
          <span>{fmt(t("bankPageOf"), { page: safePage, total: totalPages })}</span>
        )}
      </div>

      {/* ── Charts: donut + 7-day trend ── */}
      {(() => {
        const totalUsed = rows.filter((r) => r.used).length;
        const totalIdle = rows.length - totalUsed;
        const pct = rows.length > 0 ? (totalUsed / rows.length) * 100 : 0;
        const circ = 2 * Math.PI * 42;
        const filled = (pct / 100) * circ;

        // 7-day trend from linkedAt dates
        const now = new Date();
        const days: { label: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dayStr = d.toISOString().slice(0, 10);
          const label = d.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "short" });
          const count = rows.filter((r) => r.linkedAt && r.linkedAt.slice(0, 10) === dayStr).length;
          days.push({ label, count });
        }
        const maxCount = Math.max(1, ...days.map((d) => d.count));
        const trendTotal = days.reduce((s, d) => s + d.count, 0);

        return (
          <div className="flex flex-wrap gap-4 border-b px-3 py-3">
            {/* Donut chart */}
            <div className="flex items-center gap-3">
              <div className="relative" style={{ width: 100, height: 100 }}>
                <svg width={100} height={100} className="-rotate-90" aria-hidden="true">
                  <circle cx={50} cy={50} r={42} fill="none" strokeWidth={12} className="stroke-amber-200 dark:stroke-amber-800" />
                  <circle
                    cx={50} cy={50} r={42} fill="none" strokeWidth={12}
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${circ}`}
                    className="stroke-emerald-500 dark:stroke-emerald-400"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold">
                  {Math.round(pct)}%
                </span>
              </div>
              <div className="text-xs leading-5">
                <div className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-emerald-500" /> {t("bankChartUsed")}: <strong>{totalUsed}</strong></div>
                <div className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-amber-400" /> {t("bankChartIdle")}: <strong>{totalIdle}</strong></div>
              </div>
            </div>

            {/* 7-day trend bar chart */}
            <div className="flex-1 min-w-[14rem]">
              <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("bankTrendTitle")}
              </div>
              {trendTotal > 0 ? (
                <>
                  <div className="mb-1 text-[10px] text-slate-500">{fmt(t("bankTrendSubtitle"), { n: String(trendTotal) })}</div>
                  <div className="flex items-end gap-1" style={{ height: 48 }}>
                    {days.map((d) => (
                      <div key={d.label} className="flex flex-1 flex-col items-center gap-0.5">
                        <div
                          className="w-full rounded-t bg-blue-500 dark:bg-blue-400 transition-all"
                          style={{ height: d.count > 0 ? Math.max(4, (d.count / maxCount) * 36) : 2 }}
                          title={`${d.label}: ${d.count}`}
                        />
                        <span className="text-[9px] text-slate-400">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">{t("bankTrendEmpty")}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Table ── */}
      {pageRows.length === 0 ? (
        <p role="status" className="p-5 text-center text-sm text-slate-500">
          {t("bankNoResults")}
        </p>
      ) : (
        <div className="overflow-x-auto">
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
              {pageRows.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="max-w-[16rem] p-2 font-medium" title={r.prompt}>
                    {r.prompt.length > 64 ? r.prompt.slice(0, 63) + "…" : r.prompt}
                  </td>
                  <td className="p-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.courseSlug === "kimia-dasar-demo"
                          ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"
                          : r.courseSlug === "python-review-demo"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                      }`}
                    >
                      {r.courseSlug === "kimia-dasar-demo" ? t("bankCourseChem") : r.courseSlug === "python-review-demo" ? t("bankCoursePython") : t("bankCourseMath")}
                    </span>
                  </td>
                  <td className="p-2 text-slate-600 dark:text-slate-300">
                    {({ single_choice: t("bankTypeSingleChoice"), true_false: t("bankTypeTrueFalse"),
                       multiple_choice: t("bankTypeMultipleChoice"), numeric_tolerance: t("bankTypeNumeric"),
                       short_text: t("bankTypeShortText"), essay_manual: t("bankTypeEssay"),
                       file_manual: t("bankTypeFile"),
                    }[r.type] ?? r.type)}
                  </td>
                  <td className="p-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        { easy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                          medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                          hard: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                        }[r.difficulty] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {({ easy: t("bankDiffEasy"), medium: t("bankDiffMedium"), hard: t("bankDiffHard") }[r.difficulty] ?? r.difficulty)}
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
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("bankPrev")}
          </button>
          <span className="text-slate-500">{fmt(t("bankPageOf"), { page: safePage, total: totalPages })}</span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("bankNext")}
          </button>
        </div>
      )}
    </div>
  );
}
