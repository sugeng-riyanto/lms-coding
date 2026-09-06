import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";
import { assertServerResolvedRole, can } from "@/lib/permissions";
import { checkRateLimit, __resetRateLimits } from "@/lib/ratelimit";

describe("csv anti formula injection", () => {
  it("escape =,+,-,@", () => {
    expect(escapeCsvCell("=cmd|'/C calc'!A0")).toMatch(/^"'=cmd/);
    expect(escapeCsvCell("@evil")).toMatch(/^"'@evil/);
    expect(escapeCsvCell("normal")).toBe("normal");
    const csv = toCsv(["Nama", "Nilai"], [["=1+1", 90]]);
    expect(csv).toContain("'=1+1");
  });
});

describe("RBAC matrix", () => {
  it("murid tidak bisa manual_grade; guru bisa", () => {
    expect(can("student", "manual_grade")).toBe(false);
    expect(can("teacher", "manual_grade")).toBe(true);
    expect(can("student", "submit_own_attempt")).toBe(true);
    expect(can("guardian", "manual_grade")).toBe(false);
  });
  it("role harus server-resolved", () => {
    expect(() => assertServerResolvedRole(null)).toThrow();
    expect(assertServerResolvedRole("teacher")).toBe("teacher");
  });
});

describe("rate limit", () => {
  it("blokir setelah limit", () => {
    __resetRateLimits();
    expect(checkRateLimit("k", 2, 60_000, 1000)).toBe(true);
    expect(checkRateLimit("k", 2, 60_000, 1001)).toBe(true);
    expect(checkRateLimit("k", 2, 60_000, 1002)).toBe(false);
    expect(checkRateLimit("k", 2, 60_000, 1000 + 60_000)).toBe(true);
  });
});
