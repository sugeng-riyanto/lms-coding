"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { issueCertificate } from "@/features/actions";
import { makeClientEventId } from "@/lib/sync-queue";

export function IssueCertificateButton({ enrollmentId, levelId }: { enrollmentId: string; levelId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);

  async function onIssue() {
    if (!window.confirm("Terbitkan sertifikat? Eligibility dicek server.")) return;
    setBusy(true);
    setReasons([]);
    const res = await issueCertificate({ enrollmentId, levelId, idempotencyKey: makeClientEventId() });
    setBusy(false);
    if (res.ok) {
      setNotice("Sertifikat terbit.");
      router.refresh();
    } else if (res.error === "NOT_ELIGIBLE" && "reasons" in res) {
      setNotice("Belum eligible:");
      setReasons(Array.isArray(res.reasons) ? (res.reasons as string[]) : []);
    } else {
      setNotice(`Gagal: ${res.error}`);
    }
  }

  return (
    <span>
      <button
        onClick={onIssue}
        disabled={busy}
        className="rounded bg-blue-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Memeriksa…" : "Terbitkan"}
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
