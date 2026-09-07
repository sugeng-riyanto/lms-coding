import { createServiceClient } from "@/lib/supabase/service";

/**
 * Server-only persistence for certificate PDFs (ADR-009 backlog, Phase 6 KURANG
 * "persist PDF ke bucket").
 *
 * The `certificates` bucket is PRIVATE and has NO authenticated
 * insert/update/delete policy — writes and signed URLs here are the ONLY legal
 * path (service key, server-only), enforced by tests/integration/storage.test.ts.
 *
 * Design:
 *  - Object name is derived deterministically from the server-generated
 *    public_id (`{publicId}.pdf`) so the same certificate always maps to one
 *    immutable object and the QR/unique code stays consistent.
 *  - Persist is idempotent (upsert) and best-effort by callers: when storage
 *    is unavailable the PDF route falls back to on-demand rendering.
 *  - Signed URLs are short-lived and only created after the route has already
 *    enforced RLS permission (owner student / cohort teacher).
 */

export const CERTIFICATES_BUCKET = "certificates";
export const PDF_OBJECT_NAME_RE = /^[a-z0-9][a-z0-9-]*$/i;

/** Pure: maps a public_id to a safe storage object name, rejecting anything that could traverse. */
export function certificateObjectName(publicId: string): string {
  const id = publicId.trim().toLowerCase();
  if (!PDF_OBJECT_NAME_RE.test(id) || id.includes("..")) {
    throw new Error("INVALID_PUBLIC_ID");
  }
  return `${id}.pdf`;
}

export async function persistPdf(publicId: string, pdfBuffer: Uint8Array): Promise<string | null> {
  const objectName = certificateObjectName(publicId);
  const svc = createServiceClient();
  const { error: uploadError } = await svc.storage
    .from(CERTIFICATES_BUCKET)
    .upload(objectName, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;
  const { error: dbError } = await svc
    .from("certificates")
    .update({ pdf_path: objectName })
    .eq("public_id", publicId);
  if (dbError) throw dbError;
  return objectName;
}

/** Short-lived signed URL; null when storage is unavailable or the object is missing. */
export async function createPdfSignedUrl(objectName: string, ttlSeconds = 300): Promise<string | null> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.storage
      .from(CERTIFICATES_BUCKET)
      .createSignedUrl(objectName, ttlSeconds);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
