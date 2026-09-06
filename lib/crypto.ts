import { createHash, randomUUID } from "node:crypto";

export interface CertificatePayload {
  certificateId: string;
  publicId: string;
  issuerId: string;
  recipientId: string;
  courseVersionId: string;
  levelId: string;
  issuedAt: string; // ISO-8601 UTC
  serialNo: string;
}

/** Serialisasi deterministik: key diurutkan, tanpa whitespace berlebih. */
export function canonicalSerialize(payload: CertificatePayload): string {
  const ordered: Record<string, string> = {
    certificateId: payload.certificateId,
    courseVersionId: payload.courseVersionId,
    issuedAt: payload.issuedAt,
    issuerId: payload.issuerId,
    levelId: payload.levelId,
    publicId: payload.publicId,
    recipientId: payload.recipientId,
    serialNo: payload.serialNo,
  };
  return JSON.stringify(ordered);
}

export function hashPayload(payload: CertificatePayload): string {
  return createHash("sha256").update(canonicalSerialize(payload), "utf8").digest("hex");
}

export function shortFingerprint(hash: string): string {
  return hash.slice(0, 12).toUpperCase();
}

export function generatePublicId(): string {
  // unguessable: 128-bit entropy, URL-safe
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
}

export interface PublicVerificationResult {
  status: "valid" | "revoked" | "not_found" | "tampered";
  displayName?: string;
  courseTitle?: string;
  levelTitle?: string;
  issuedAt?: string;
  serialNo?: string;
  fingerprint?: string;
  chainAnchored?: boolean;
}
