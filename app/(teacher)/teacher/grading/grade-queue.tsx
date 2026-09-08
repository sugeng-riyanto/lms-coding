"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveAiDraft, gradeResponse, rejectAiDraft, requestAiDraft } from "@/features/actions";
import type { AiConfig, QueueItem } from "./page";
import { RubricGradePanel } from "@/components/rubric-grade-panel";
import { ResponseCanvasArea } from "@/components/response-canvas";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { AI_ERROR_KEY, GRADING } from "@/lib/ui-text/grading";

function aiErrorText(t: (k: keyof typeof GRADING) => string, code: string): string {
  const key = AI_ERROR_KEY[code];
  return key ? t(key) : code;
}

export function GradeQueue({
  initialItems,
  aiConfig,
  lang,
}: {
  initialItems: QueueItem[];
  aiConfig: AiConfig;
  lang: Lang;
}) {
  const t = mkT(GRADING, lang);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  async function onGrade(item: QueueItem) {
    setBusy(item.responseId);
    const res = await gradeResponse({
      responseId: item.responseId,
      manualScore: Number(scores[item.responseId] ?? "0"),
      feedback: feedbacks[item.responseId] ?? "",
    });
    setBusy(null);
    setNotice(res.ok ? t("noticeSaved") : fmt(t("failPrefix"), { error: res.error }));
    if (res.ok) router.refresh();
  }

  async function onRequestDraft(item: QueueItem) {
    setBusy(item.responseId);
    const res = await requestAiDraft({ responseId: item.responseId });
    setBusy(null);
    setNotice(res.ok ? t("noticeDraftCreated") : fmt(t("failPrefix"), { error: aiErrorText(t, res.error) }));
    if (res.ok) router.refresh();
  }

  async function onApprove(item: QueueItem) {
    if (!item.aiDraft) return;
    setBusy(item.responseId);
    const res = await approveAiDraft({ draftId: item.aiDraft.id });
    setBusy(null);
    setNotice(res.ok ? t("noticeDraftApproved") : fmt(t("failPrefix"), { error: aiErrorText(t, res.error) }));
    if (res.ok) router.refresh();
  }

  async function onReject(item: QueueItem) {
    if (!item.aiDraft) return;
    setBusy(item.responseId);
    const res = await rejectAiDraft({ draftId: item.aiDraft.id });
    setBusy(null);
    setNotice(res.ok ? t("noticeDraftRejected") : fmt(t("failPrefix"), { error: aiErrorText(t, res.error) }));
    if (res.ok) router.refresh();
  }

  if (initialItems.length === 0) {
    return (
      <p className="mt-6 rounded-xl border p-5" role="status">
        {t("queueEmpty")}
      </p>
    );
  }

  const aiBlockedReason = !aiConfig.enabled
    ? t("aiBlockedEnv")
    : !aiConfig.consent
      ? t("aiBlockedConsent")
      : null;

  return (
    <div className="mt-6 space-y-4">
      {notice && (
        <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">
          {notice}
        </p>
      )}
      {initialItems.map((it) => (
        <section
          key={it.responseId}
          aria-label={fmt(t("gradeAria"), { name: it.studentName })}
          className="rounded-xl border p-4"
        >
          <p className="font-semibold">
            {fmt(t("attemptHeader"), { student: it.studentName, no: it.attemptNo, status: it.attemptStatus })}
          </p>
          <p className="mt-1 text-sm">
            <strong>{fmt(t("questionLabel"), { type: it.qtype })}</strong> {it.promptText}
          </p>
          <p className="mt-1 rounded bg-slate-50 p-2 text-sm">
            {t("answerLabel")} {JSON.stringify(it.answer)?.slice(0, 500)}
          </p>
          {/* Kanvas anotasi sains/math: coretan murid (read-only) + umpan balik guru. */}
          <ResponseCanvasArea attemptId={it.attemptId} questionVersionId={it.questionVersionId} lang={lang} />
          {it.revisions.length > 0 && (
            <ul className="mt-1 text-xs text-slate-500">
              {it.revisions.map((r, i) => (
                <li key={i}>
                  {fmt(t("revisionLine"), {
                    prev: r.previous ?? "—",
                    next: r.new ?? "—",
                    reason: r.reason,
                    at: r.at,
                  })}
                </li>
              ))}
            </ul>
          )}
          {it.rubric ? (
            <RubricGradePanel responseId={it.responseId} rubric={it.rubric} lang={lang} />
          ) : (
            <>
              {/* AI draft feedback (ADR-014/015): draft jelas berlabel, wajib persetujuan guru. */}
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
                {aiBlockedReason ? (
                  <button
                    type="button"
                    disabled
                    title={aiBlockedReason}
                    aria-disabled="true"
                    className="cursor-not-allowed rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500"
                  >
                    {t("aiBlockedDisabled")}
                  </button>
                ) : !it.aiDraft || it.aiDraft.status === "rejected" ? (
                  <button
                    type="button"
                    onClick={() => onRequestDraft(it)}
                    disabled={busy !== null}
                    className="rounded-lg border border-amber-600 px-3 py-1.5 text-sm font-semibold text-amber-800 disabled:opacity-60 dark:text-amber-200"
                  >
                    {busy === it.responseId
                      ? t("requesting")
                      : it.aiDraft?.status === "rejected"
                        ? t("requestDraftRejected")
                        : t("requestDraft")}
                  </button>
                ) : it.aiDraft.status === "draft" ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      {t("draftLabel")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap rounded bg-white/60 p-2 text-sm dark:bg-slate-900/40">
                      {it.aiDraft.body}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {fmt(t("modelLabel"), { model: it.aiDraft.model })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onApprove(it)}
                        disabled={busy !== null}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {busy === it.responseId ? t("approving") : t("approve")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(it)}
                        disabled={busy !== null}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
                      >
                        {busy === it.responseId ? t("rejecting") : t("reject")}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">{t("draftApproved")}</p>
                )}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div>
                  <label htmlFor={`s-${it.responseId}`} className="text-sm font-semibold">
                    {t("scoreLabel")}
                  </label>
                  <input
                    id={`s-${it.responseId}`}
                    type="number"
                    min={0}
                    max={100}
                    value={scores[it.responseId] ?? ""}
                    onChange={(e) => setScores((s) => ({ ...s, [it.responseId]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={`f-${it.responseId}`} className="text-sm font-semibold">
                    {t("feedbackLabel")}
                  </label>
                  <input
                    id={`f-${it.responseId}`}
                    value={feedbacks[it.responseId] ?? ""}
                    onChange={(e) => setFeedbacks((s) => ({ ...s, [it.responseId]: e.target.value }))}
                    maxLength={5000}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>
              <button
                onClick={() => onGrade(it)}
                disabled={busy !== null}
                className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {busy === it.responseId ? t("saving") : t("saveScore")}
              </button>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
