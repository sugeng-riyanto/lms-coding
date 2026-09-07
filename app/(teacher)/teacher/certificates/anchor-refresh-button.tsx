"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshAnchorStatus } from "@/features/actions";

function errText(code: string): string {
  const map: Record<string, string> = {
    BLOCKCHAIN_DISABLED: "Anchoring blockchain nonaktif (BLOCKCHAIN_ANCHOR_ENABLED=false).",
    BLOCKCHAIN_PROVIDER_PENDING: "Provider belum dipilih (ADR-018) — hanya mode mock aktif.",
    UNAUTHENTICATED: "Sesi tidak valid.",
    FORBIDDEN: "Aksi ini hanya untuk guru aktif.",
  };
  return map[code] ?? code;
}

/** Menanyakan status anchor yang pending ke adapter dan menaikkan ke final bila
 * sudah final (mock-algorand: deterministik tanpa jaringan). */
export function AnchorRefreshButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function onRefresh() {
    setBusy(true);
    setNotice("");
    const res = await refreshAnchorStatus();
    setBusy(false);
    if (res.ok) {
      if (res.finalized === 0) {
        setNotice("Tidak ada anchor pending yang naik ke final saat ini.");
      } else {
        setNotice(`${res.finalized} anchor pending kini final.`);
      }
    } else {
      setNotice(`Gagal: ${errText(res.error)}`);
    }
    router.refresh();
  }

  if (!enabled) {
    return null;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
      >
        {busy ? "Memeriksa status…" : "Refresh status anchor"}
      </button>
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
    </div>
  );
}
