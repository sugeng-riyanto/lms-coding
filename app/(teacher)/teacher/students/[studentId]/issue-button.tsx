"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { issueCertificate } from "@/features/actions";
import { makeClientEventId } from "@/lib/sync-queue";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { STUDENT_DETAIL } from "@/lib/ui-text/student-detail";

export function IssueCertificateButton({
  enrollmentId,
  levelId,
  lang,
}: {
  enrollmentId: string;
  levelId: string;
  lang: Lang;
}) {
  const router = useRouter();
  const t = mkT(STUDENT_DETAIL, lang);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);

  async function onIssue() {
    if (!window.confirm(t("issueConfirm"))) return;
    setBusy(true);
    setReasons([]);
    const res = await issueCertificate({ enrollmentId, levelId, idempotencyKey: makeClientEventId() });
    setBusy(false);
    if (res.ok) {
      setNotice(t("issued"));
      router.refresh();
    } else if (res.error === "NOT_ELIGIBLE" && "reasons" in res) {
      setNotice(t("notEligible"));
      setReasons(Array.isArray(res.reasons) ? (res.reasons as string[]) : []);
    } else {
      setNotice(fmt(t("failed"), { error: res.error }));
    }
  }

  return (
    <span>
      <button
        onClick={onIssue}
        disabled={busy}
        className="rounded bg-blue-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? t("checking") : t("issueButton")}
      </button>
      {notice && (
        <span role="status" className="ml-2 text-xs">
          {notice}
        </span>
      )}
      {reasons.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs text-red-700">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </span>
  );
}
