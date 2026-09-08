"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { anchorCertificateBatch } from "@/features/actions";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { CERT } from "@/lib/ui-text/cert";

function errText(code: string, t: (k: keyof typeof CERT) => string): string {
  const map: Record<string, string> = {
    BLOCKCHAIN_DISABLED: t("errBlockchainDisabled"),
    BLOCKCHAIN_PROVIDER_PENDING: t("errProviderPending"),
    ANCHOR_FAILED: t("errAnchorFailed"),
    ANCHOR_EMPTY: t("errAnchorEmpty"),
    UNAUTHENTICATED: t("errUnauthenticated"),
    FORBIDDEN: t("errForbidden"),
  };
  return map[code] ?? code;
}

export function AnchorBatchButton({ enabled, lang = "id" }: { enabled: boolean; lang?: Lang }) {
  const t = mkT(CERT, lang);
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
        setNotice(t("batchNoNew"));
      } else {
        const ref = res.reference ? fmt(t("batchRef"), { ref: res.reference }) : "";
        setNotice(
          fmt(t("batchOk"), {
            n: res.anchored,
            root: res.root?.slice(0, 16) ?? "",
            status: res.status ?? "",
            ref,
          }),
        );
      }
    } else {
      setNotice(fmt(t("failed"), { msg: errText(res.error, t) }));
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
        {busy ? t("batchBusy") : t("batchIdle")}
      </button>
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
    </div>
  );
}
