"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Upload submission ke bucket private `submissions` (folder /<uid>/...).
 * MIME + size divalidasi client DAN diharapkan RLS/storage policy server.
 */
const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];
const MAX_BYTES = 10 * 1024 * 1024;

export function UploadBox({ onUploaded }: { onUploaded: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!ALLOWED.includes(file.type)) {
      setError("Tipe file ditolak. Hanya PDF/PNG/JPEG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File maksimal 10MB.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) throw new Error("belum masuk");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${uid}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("submissions").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      onUploaded(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload gagal.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-2">
      <label htmlFor="submission-file" className="text-sm font-semibold">
        Upload file (PDF/PNG/JPEG ≤10MB)
      </label>
      <input
        id="submission-file"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        disabled={busy}
        onChange={(e) => onFile(e.target.files?.[0])}
        className="mt-1 block w-full text-sm"
      />
      {busy && (
        <p role="status" className="text-sm text-slate-500">
          Mengunggah…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
