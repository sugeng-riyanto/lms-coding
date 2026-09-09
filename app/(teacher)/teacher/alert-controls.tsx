"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  acknowledgeAlert,
  assignAlert,
  reopenAlert,
  resolveAlert,
  snoozeAlert,
} from "@/features/actions";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { DASH } from "@/lib/ui-text/dash";

export interface AlertItem {
  id: string;
  student_id: string;
  code: string;
  message: string;
  status: string;
  studentName: string;
  assigned_to: string | null;
  due_at: string | null;
  escalation_level: number;
}

export function AlertControls({
  cohortId: _cohortId,
  alerts,
  lang = "id",
  currentUserId,
}: {
  cohortId: string;
  alerts: AlertItem[];
  lang?: Lang;
  currentUserId?: string;
}) {
  const t = mkT(DASH, lang);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [reopenReason, setReopenReason] = useState<Record<string, string>>({});

  if (alerts.length === 0) {
    return (
      <p className="mt-3 rounded-xl border p-4" role="status">
        {t("noSignals")}
      </p>
    );
  }

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, isAuto: boolean) {
    setBusy(id);
    if (isAuto) {
      setDismissed((d) => [...d, id]);
    } else {
      await fn();
      router.refresh();
    }
    setBusy(null);
  }

  const visible = alerts.filter((a) => !dismissed.includes(a.id));

  return (
    <ul className="mt-3 space-y-2">
      {visible.map((s) => {
        const isAuto = s.id.startsWith("auto-");
        const isOverdue =
          s.due_at && new Date(s.due_at) < new Date() && ["open", "acknowledged", "snoozed"].includes(s.status);
        const isResolved = s.status === "resolved";
        const isReopened = s.status === "reopened";

        return (
          <li key={s.id} className="rounded-xl border p-3">
            <p>
              <strong>{s.studentName}</strong>{" "}
              <span className="font-mono text-xs font-bold">{s.code}</span>
              {isReopened && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                  {t("statusReopened")}
                </span>
              )}
            </p>
            <p className="text-sm">{s.message}</p>

            {/* Escalation badge */}
            {s.escalation_level > 0 && (
              <p className="mt-1 text-xs text-red-600">
                {fmt(t("escalationLevel"), { level: String(s.escalation_level) })}
              </p>
            )}

            {/* Due date + overdue indicator */}
            {s.due_at && (
              <p className={`mt-1 text-xs ${isOverdue ? "font-bold text-red-700" : "text-slate-500"}`}>
                {fmt(t("dueLabel"), { date: new Date(s.due_at).toLocaleDateString() })}
                {isOverdue && ` — ${t("overdue")}`}
              </p>
            )}

            {/* Assigned teacher */}
            {s.assigned_to && (
              <p className="mt-1 text-xs text-slate-500">
                {fmt(t("assignedTo"), {
                  name: s.assigned_to === currentUserId ? (lang === "en" ? "you" : "Anda") : s.assigned_to.slice(0, 8),
                })}
              </p>
            )}

            {!isAuto && !isResolved && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  disabled={busy !== null}
                  onClick={() => run(s.id, () => acknowledgeAlert({ alertId: s.id }), false)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  {t("acknowledge")}
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => run(s.id, () => snoozeAlert({ alertId: s.id }), false)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  {t("snooze3d")}
                </button>
                {/* Assign to self */}
                {currentUserId && s.assigned_to !== currentUserId && (
                  <button
                    disabled={busy !== null}
                    onClick={() =>
                      run(
                        s.id,
                        () =>
                          assignAlert({
                            alertId: s.id,
                            assignedTo: currentUserId,
                          }),
                        false,
                      )
                    }
                    className="rounded border border-blue-300 bg-blue-50 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900/30"
                  >
                    {t("assignSelf")}
                  </button>
                )}
                <input
                  aria-label={fmt(t("interventionNoteAria"), { name: s.studentName })}
                  placeholder={t("interventionNotePlaceholder")}
                  value={note[s.id] ?? ""}
                  onChange={(e) => setNote((n) => ({ ...n, [s.id]: e.target.value }))}
                  className="rounded border px-2 py-1 text-sm"
                />
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    run(s.id, () => resolveAlert({ alertId: s.id, note: note[s.id] ?? "" }), false)
                  }
                  className="rounded border px-3 py-1 text-sm"
                >
                  {t("resolve")}
                </button>
              </div>
            )}

            {/* Reopen button for resolved alerts */}
            {!isAuto && isResolved && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  aria-label={fmt(t("reopenReason"), { name: s.studentName })}
                  placeholder={t("reopenReason")}
                  value={reopenReason[s.id] ?? ""}
                  onChange={(e) => setReopenReason((n) => ({ ...n, [s.id]: e.target.value }))}
                  className="rounded border px-2 py-1 text-sm"
                />
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    run(
                      s.id,
                      () => reopenAlert({ alertId: s.id, reason: reopenReason[s.id] ?? "" }),
                      false,
                    )
                  }
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-700 dark:bg-amber-900/30"
                >
                  {t("reopen")}
                </button>
              </div>
            )}

            {isAuto && (
              <div className="mt-2">
                <button
                  disabled={busy !== null}
                  onClick={() => run(s.id, async () => ({ ok: true }), true)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  {t("dismissSession")}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
