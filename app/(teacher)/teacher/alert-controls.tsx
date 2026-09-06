"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeAlert, resolveAlert, snoozeAlert } from "@/features/actions";

export interface AlertItem {
  id: string;
  student_id: string;
  code: string;
  message: string;
  status: string;
  studentName: string;
}

export function AlertControls({ alerts }: { cohortId: string; alerts: AlertItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<string[]>([]);

  if (alerts.length === 0) {
    return (
      <p className="mt-3 rounded-xl border p-4" role="status">
        Tidak ada sinyal. 🎉
      </p>
    );
  }

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, isAuto: boolean) {
    setBusy(id);
    if (isAuto) {
      // Sinyal auto dihitung live; dismiss hanya sesi ini (tidak dipersist).
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
        return (
          <li key={s.id} className="rounded-xl border p-3">
            <p>
              <strong>{s.studentName}</strong> <span className="font-mono text-xs font-bold">{s.code}</span>
            </p>
            <p className="text-sm">{s.message}</p>
            {!isAuto && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  disabled={busy !== null}
                  onClick={() => run(s.id, () => acknowledgeAlert({ alertId: s.id }), false)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  Acknowledge
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => run(s.id, () => snoozeAlert({ alertId: s.id }), false)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  Snooze 3 hari
                </button>
                <input
                  aria-label={`Catatan intervensi ${s.studentName}`}
                  placeholder="Catatan intervensi…"
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
                  Resolve
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
                  Dismiss sesi ini
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
