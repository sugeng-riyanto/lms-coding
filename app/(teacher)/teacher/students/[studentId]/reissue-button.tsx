"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { reissueCertificate } from "@/features/actions";

const MIN_REASON = 5;

/**
 * Reissue sertifikat yang masih active (guru cohort): dialog alasan wajib →
 * konfirmasi → server action. Eligibility dievaluasi ulang server-side
 * SEBELUM revoke (ADR-013); bila ditolak, dialog menampilkan alasannya dan
 * sertifikat lama tetap active.
 */
export function ReissueCertificateButton({
  certificateId,
  serialNo,
}: {
  certificateId: string;
  serialNo: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const reasonId = useId();
  const noticeId = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [reason, setReason] = useState("");

  async function onSubmit() {
    if (busy) return;
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      setNotice(`Alasan minimal ${MIN_REASON} karakter.`);
      return;
    }
    setBusy(true);
    setNotice("");
    setReasons([]);
    const res = await reissueCertificate({ certificateId, reason: trimmed });
    setBusy(false);
    if (res.ok) {
      dialogRef.current?.close();
      setReason("");
      setNotice("");
      router.refresh();
    } else if (res.error === "NOT_ELIGIBLE" && "reasons" in res) {
      setNotice("Belum eligible — sertifikat lama tidak diubah:");
      setReasons(Array.isArray(res.reasons) ? (res.reasons as string[]) : []);
    } else {
      const messages: Record<string, string> = {
        NOT_ACTIVE: "Sertifikat tidak lagi aktif. Muat ulang halaman.",
        NOT_FOUND_OR_FORBIDDEN: "Sertifikat tidak ditemukan atau di luar cohort Anda.",
        REISSUE_FAILED: "Reissue gagal. Silakan coba lagi.",
      };
      setNotice(messages[res.error] ?? `Gagal: ${res.error}`);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded border border-amber-700 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
      >
        Reissue
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        className="w-full max-w-md rounded-lg border border-slate-300 p-5 shadow-lg backdrop:bg-slate-900/40"
        onClose={() => setNotice("")}
      >
        <h3 id={headingId} className="text-lg font-semibold">
          Reissue sertifikat {serialNo}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Sertifikat lama akan di-revoke dan sertifikat baru diterbitkan dalam satu transaksi. Eligibility
          dicek ulang server-side; alasan dicatat di audit log.
        </p>
        <div className="mt-4">
          <label htmlFor={reasonId} className="block text-sm font-medium">
            Alasan reissue <span className="text-red-700">(wajib)</span>
          </label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={MIN_REASON}
            maxLength={2000}
            rows={3}
            className="mt-1 w-full rounded border border-slate-400 px-2 py-1 text-sm"
            aria-describedby={noticeId}
          />
        </div>
        {notice && (
          <p id={noticeId} role="status" className="mt-2 text-sm text-red-700">
            {notice}
          </p>
        )}
        {reasons.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-xs text-red-700">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={busy}
            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            aria-busy={busy}
            className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Memproses…" : "Reissue"}
          </button>
        </div>
      </dialog>
    </>
  );
}
