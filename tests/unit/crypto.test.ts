import { describe, expect, it } from "vitest";
import { canonicalSerialize, generatePublicId, hashPayload, shortFingerprint } from "@/lib/crypto";

const base = {
  certificateId: "c1",
  publicId: "p1",
  issuerId: "i1",
  recipientId: "r1",
  courseVersionId: "cv1",
  levelId: "l1",
  issuedAt: "2026-01-15T00:00:00Z",
  serialNo: "S-1",
};

describe("certificate hash deterministik", () => {
  it("serialisasi stabil & hash 64 hex", () => {
    expect(canonicalSerialize(base)).toBe(canonicalSerialize({ ...base }));
    const h = hashPayload(base);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(shortFingerprint(h)).toHaveLength(12);
  });
  it("perubahan payload terdeteksi", () => {
    expect(hashPayload(base)).not.toBe(hashPayload({ ...base, serialNo: "S-2" }));
  });
  it("publicId unguessable", () => {
    const a = generatePublicId();
    const b = generatePublicId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});
