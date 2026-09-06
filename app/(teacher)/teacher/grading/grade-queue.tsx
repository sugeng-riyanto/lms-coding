"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveAiDraft, gradeResponse, rejectAiDraft, requestAiDraft } from "@/features/actions";
import type { AiConfig, QueueItem } from "./page";
import { RubricGradePanel } from "@/components/rubric-grade-panel";

function aiErrorText(code: string): string {
  const map: Record<string, string> = {
    AI_DISABLED: "Fitur AI nonaktif.",
    AI_PROVIDER_UNCONFIGURED: "Provider AI belum dikonfigurasi.",
    AI_NO_CONSENT: "Organisasi belum menyetujui penggunaan AI.",
    AI_PROVIDER_ERROR: "Provider AI gagal merespons — coba lagi.",
    DRAFT_FAILED: "Gagal menyimpan draf.",
    APPROVE_FAILED: "Gagal menyetujui draf.",
    REJECT_FAILED: "Gagal menolak draf.",
    ALREADY_APPROVED: "Draf sudah disetujui.",
    NOT_FOUND: "Data tidak ditemukan.",
  };
  return map[code] ?? code;
}

export function GradeQueue({ initialItems, aiConfig }: { initialItems: QueueItem[]; aiConfig: AiConfig }) {
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
    setNotice(res.ok ? "Nilai tersimpan (revisi tercatat)." : `Gagal: ${res.error}`);
    if (res.ok) router.refresh();
  }

  async function onRequestDraft(item: QueueItem) {
    setBusy(item.responseId);
    const res = await requestAiDraft({ responseId: item.responseId });
    setBusy(null);
    setNotice(res.ok ? "Draf AI dibuat — tinjau sebelum menyetujui." : `Gagal: ${aiErrorText(res.error)}`);
    if (res.ok) router.refresh();
  }

  async function onApprove(item: QueueItem) {
    if (!item.aiDraft) return;
    setBusy(item.responseId);
    const res = await approveAiDraft({ draftId: item.aiDraft.id });
    setBusy(null);
    setNotice(
      res.ok
        ? "Draf AI disetujui — feedback terpasang (audit tercatat)."
        : `Gagal: ${aiErrorText(res.error)}`,
    );
    if (res.ok) router.refresh();
  }

  async function onReject(item: QueueItem) {
    if (!item.aiDraft) return;
    setBusy(item.responseId);
    const res = await rejectAiDraft({ draftId: item.aiDraft.id });
    setBusy(null);
    setNotice(res.ok ? "Draf AI ditolak." : `Gagal: ${aiErrorText(res.error)}`);
    if (res.ok) router.refresh();
  }

  if (initialItems.length === 0) {
    return (
      <p className="mt-6 rounded-xl border p-5" role="status">
        Antrian kosong. 🎉
      </p>
    );
  }

  const aiBlockedReason = !aiConfig.enabled
    ? "Fitur AI nonaktif (AI_FEEDBACK_ENABLED=false)."
    : !aiConfig.consent
      ? "Organisasi belum menyetujui penggunaan AI."
      : null;

  return (
    <div className="mt-6 space-y-4">
      {notice && (
        <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">
          {notice}
        </p>
      )}
      {initialItems.map((it) => (
        <section key={it.responseId} aria-label={`Nilai ${it.studentName}`} className="rounded-xl border p-4">
          <p className="font-semibold">
            {it.studentName} · attempt #{it.attemptNo} ({it.attemptStatus})
          </p>
          <p className="mt-1 text-sm">
            <strong>Soal [{it.qtype}]:</strong> {it.promptText}
          </p>
          <p className="mt-1 rounded bg-slate-50 p-2 text-sm">
            Jawaban: {JSON.stringify(it.answer)?.slice(0, 500)}
          </p>
          {it.revisions.length > 0 && (
            <ul className="mt-1 text-xs text-slate-500">
              {it.revisions.map((r, i) => (
                <li key={i}>
                  Revisi: {r.previous ?? "—"} → {r.new ?? "—"} · {r.reason} · {r.at}
                </li>
              ))}
            </ul>
          )}
          {it.rubric ? (
            <RubricGradePanel responseId={it.responseId} rubric={it.rubric} />
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
                    Saran draf AI (nonaktif)
                  </button>
                ) : !it.aiDraft || it.aiDraft.status === "rejected" ? (
                  <button
                    type="button"
                    onClick={() => onRequestDraft(it)}
                    disabled={busy !== null}
                    className="rounded-lg border border-amber-600 px-3 py-1.5 text-sm font-semibold text-amber-800 disabled:opacity-60 dark:text-amber-200"
                  >
                    {busy === it.responseId
                      ? "Meminta…"
                      : it.aiDraft?.status === "rejected"
                        ? "Minta draf AI baru (yang lama ditolak)"
                        : "Saran draf AI"}
                  </button>
                ) : it.aiDraft.status === "draft" ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      DRAFT AI — perlu persetujuan guru
                    </p>
                    <p className="mt-1 whitespace-pre-wrap rounded bg-white/60 p-2 text-sm dark:bg-slate-900/40">
                      {it.aiDraft.body}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Model: {it.aiDraft.model}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onApprove(it)}
                        disabled={busy !== null}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {busy === it.responseId ? "Menyetujui…" : "Setujui & pakai"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(it)}
                        disabled={busy !== null}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
                      >
                        {busy === it.responseId ? "Menolak…" : "Tolak"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    ✓ Draft AI disetujui — feedback sudah terpasang (penanda ai_approved, audit tercatat).
                  </p>
                )}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div>
                  <label htmlFor={`s-${it.responseId}`} className="text-sm font-semibold">
                    Skor manual (0–100)
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
                    Feedback
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
                {busy === it.responseId ? "Menyimpan…" : "Simpan nilai"}
              </button>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
