"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshAnchorStatus } from "@/features/actions";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { CERT } from "@/lib/ui-text/cert";

function errText(code: string, t: (k: keyof typeof CERT) => string): string {
  const map: Record<string, string> = {
    BLOCKCHAIN_DISABLED: t("errBlockchainDisabled"),
    BLOCKCHAIN_PROVIDER_PENDING: t("errProviderPending"),
    UNAUTHENTICATED: t("errUnauthenticated"),
    FORBIDDEN: t("errForbidden"),
  };
  return map[code] ?? code;
}

/** Menanyakan status anchor yang pending ke adapter dan menaikkan ke final bila
 * sudah final (mock-algorand: deterministik tanpa jaringan). */
export function AnchorRefreshButton({ enabled, lang = "id" }: { enabled: boolean; lang?: Lang }) {
  const t = mkT(CERT, lang);
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
        setNotice(t("refreshNone"));
      } else {
        setNotice(fmt(t("refreshOk"), { n: res.finalized }));
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
        onClick={onRefresh}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
      >
        {busy ? t("refreshBusy") : t("refreshIdle")}
      </button>
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
    </div>
  );
}
