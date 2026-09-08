"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitReview } from "@/features/actions";
import { fmt, mkT, localeFor, type Lang } from "@/lib/i18n";
import { REVIEW } from "@/lib/ui-text/review";

export interface DueItem {
  id: string;
  title: string;
  dueAt: string;
  intervalIdx: number;
}

function dueLabel(dueAt: string, now: Date, t: ReturnType<typeof mkT<typeof REVIEW>>): string {
  const ms = Date.parse(dueAt) - now.getTime();
  const days = Math.ceil(ms / 86_400_000);
  if (days <= -1) return fmt(t("overdueDays"), { n: -days });
  if (days === 0) return t("dueToday");
  return fmt(t("dueInDays"), { n: days });
}

export function ReviewForm({
  enrollmentId,
  courseTitle,
  items,
  lang,
}: {
  enrollmentId: string;
  courseTitle: string;
  items: DueItem[];
  lang: Lang;
}) {
  const router = useRouter();
  const t = mkT(REVIEW, lang);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const now = new Date();
  const confidenceLabels = [
    t("confidenceNotUnderstood"),
    t("confidenceSomewhat"),
    t("confidenceOkay"),
    t("confidenceUnderstood"),
    t("confidenceVery"),
  ];

  async function answer(itemId: string, confidence: number) {
    setBusyId(itemId);
    setNotice("");
    const res = await submitReview({ reviewItemId: itemId, enrollmentId, confidence });
    setBusyId(null);
    if (res.ok) {
      setNotice(
        fmt(t("doneNext"), {
          title: items.find((i) => i.id === itemId)?.title ?? "",
          date: new Date(res.nextDueAt).toLocaleDateString(localeFor(lang), {
            day: "numeric",
            month: "long",
          }),
        }),
      );
      router.refresh();
    } else {
      setNotice(
        res.error === "NOT_DUE"
          ? t("notDue")
          : res.error === "NOT_SCHEDULED"
            ? t("notScheduled")
            : t("saveFailed"),
      );
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-slate-600">
        {fmt(t("queueSummary"), { course: courseTitle, n: items.length })}
      </p>
      {items.map((item) => (
        <section
          key={item.id}
          aria-label={fmt(t("itemAria"), { title: item.title })}
          className="rounded-xl border p-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{item.title}</h2>
            <p className="text-sm text-slate-600">{dueLabel(item.dueAt, now, t)}</p>
          </div>
          <fieldset disabled={busyId !== null} className="mt-3">
            <legend className="text-sm font-medium text-slate-700">{t("howWell")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {confidenceLabels.map((label, idx) => {
                const value = idx + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => answer(item.id, value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-blue-50 disabled:opacity-60"
                  >
                    {value} — {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>
      ))}
      {notice && (
        <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {notice}
        </p>
      )}
    </div>
  );
}
