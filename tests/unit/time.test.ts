import { describe, expect, it } from "vitest";
import { DISPLAY_TIMEZONE, formatJakarta, isPastUtc, nowUtcIso } from "@/lib/time";

describe("timezone Asia/Jakarta, simpan UTC", () => {
  it("nowUtcIso selalu ISO UTC (akhiran Z)", () => {
    expect(nowUtcIso(new Date("2026-01-15T00:00:00Z"))).toBe("2026-01-15T00:00:00.000Z");
  });
  it("formatJakarta menggeser +7 jam", () => {
    // 00:00 UTC = 07:00 WIB
    expect(formatJakarta("2026-01-15T00:00:00Z")).toMatch(/07\.00 WIB/);
    expect(DISPLAY_TIMEZONE).toBe("Asia/Jakarta");
  });
  it("timestamp invalid ditolak", () => {
    expect(() => formatJakarta("bukan-tanggal")).toThrow("INVALID_TIMESTAMP");
    expect(() => isPastUtc("bukan-tanggal")).toThrow("INVALID_TIMESTAMP");
  });
  it("isPastUtc untuk deadline server-side", () => {
    expect(isPastUtc("2020-01-01T00:00:00Z")).toBe(true);
    expect(isPastUtc("2999-01-01T00:00:00Z")).toBe(false);
  });
});
