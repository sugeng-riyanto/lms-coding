"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { anchorCertificateBatch } from "@/features/actions";

function errText(code: string): string {
  const map: Record<string, string> = {
    BLOCKCHAIN_DISABLED: "Anchoring blockchain nonaktif (BLOCKCHAIN_ANCHOR_ENABLED=false).",
    BLOCKCHAIN_PROVIDER_PENDING: "Provider belum dipilih (ADR-018) — hanya mode mock aktif.",
    ANCHOR_FAILED: "Anchor gagal — coba lagi nanti.",
    ANCHOR_EMPTY: "Batch kosong — tidak ada payload hash valid.",
    UNAUTHENTICATED: "Sesi tidak valid.",
    FORBIDDEN: "Aksi ini hanya untuk guru aktif.",
  };
  return map[code] ?? code;
}

export function AnchorBatchButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function onAnchor() {
    setBusy(true);
    setNotice("");
    const res = await anchorCertificateBatch();
    setBusy(false);
    if (res.ok) {
      if (res.anchored === 0) {
        setNotice("Tidak ada sertifikat baru untuk di-anchor (semua sudah ter-anchor).");
      } else {
        const ref = res.reference ? ` · tx ${res.reference}` : "";
        setNotice(
          `${res.anchored} sertifikat di-anchor (Merkle root ${res.root?.slice(0, 16)}…, status ${res.status})${ref}.`,
        );
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
        onClick={onAnchor}
        disabled={busy}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Meng-anchor…" : "Anchor batch sertifikat"}
      </button>
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
    </div>
  );
}
