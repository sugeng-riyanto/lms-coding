import { describe, expect, it } from "vitest";
import {
  MAX_DRAFT_CHARS,
  MAX_HEARTBEAT_ACTIVE_MS,
  MIN_HEARTBEAT_INTERVAL_MS,
  clampActiveMs,
  nextHeartbeatAllowed,
  validateDraftMetadata,
  validateHeartbeatMetadata,
} from "@/lib/active-time";

describe("clampActiveMs", () => {
  it("nilai normal diteruskan (di-floor)", () => {
    expect(clampActiveMs(30_000)).toBe(30_000);
    expect(clampActiveMs(30_999.7)).toBe(30_999);
  });
  it("dibatasi ke MAX_HEARTBEAT_ACTIVE_MS", () => {
    expect(clampActiveMs(MAX_HEARTBEAT_ACTIVE_MS * 10)).toBe(MAX_HEARTBEAT_ACTIVE_MS);
  });
  it("negatif / nol / non-finite / non-number → 0", () => {
    expect(clampActiveMs(-5)).toBe(0);
    expect(clampActiveMs(0)).toBe(0);
    expect(clampActiveMs(Number.NaN)).toBe(0);
    expect(clampActiveMs(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampActiveMs("bukan angka")).toBe(0);
  });
});

describe("validateHeartbeatMetadata", () => {
  it("terima activeMs sah dan mengembalikan nilai ter-clamp", () => {
    const v = validateHeartbeatMetadata({ activeMs: 30_000 });
    expect(v).toEqual({ ok: true, activeMs: 30_000 });
  });
  it("tolak tanpa activeMs atau nol", () => {
    expect(validateHeartbeatMetadata({}).ok).toBe(false);
    expect(validateHeartbeatMetadata({ activeMs: 0 }).ok).toBe(false);
  });
  it("tolak nilai raksasa (client nakal) meski clamp bisa", () => {
    expect(validateHeartbeatMetadata({ activeMs: MAX_HEARTBEAT_ACTIVE_MS * 3 }).ok).toBe(false);
  });
  it("tolak non-finite", () => {
    expect(validateHeartbeatMetadata({ activeMs: Number.NaN }).ok).toBe(false);
  });
});

describe("nextHeartbeatAllowed", () => {
  it("selalu boleh saat belum pernah kirim", () => {
    expect(nextHeartbeatAllowed(null, 1_000)).toBe(true);
  });
  it("ditolak bila jarak < interval minimum", () => {
    expect(nextHeartbeatAllowed(1_000, 1_000 + MIN_HEARTBEAT_INTERVAL_MS - 1)).toBe(false);
  });
  it("diizinkan bila jarak >= interval minimum", () => {
    expect(nextHeartbeatAllowed(1_000, 1_000 + MIN_HEARTBEAT_INTERVAL_MS)).toBe(true);
  });
});

describe("validateDraftMetadata", () => {
  it("terima panjang draf normal", () => {
    expect(validateDraftMetadata({ chars: 120 })).toEqual({ ok: true, chars: 120 });
  });
  it("tolak panjang melebihi MAX_DRAFT_CHARS", () => {
    expect(validateDraftMetadata({ chars: MAX_DRAFT_CHARS + 1 }).ok).toBe(false);
  });
  it("tolak negatif / non-finite", () => {
    expect(validateDraftMetadata({ chars: -1 }).ok).toBe(false);
    expect(validateDraftMetadata({ chars: Number.NaN }).ok).toBe(false);
  });
});
