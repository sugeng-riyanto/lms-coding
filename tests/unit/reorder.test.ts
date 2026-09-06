import { describe, expect, it } from "vitest";
import { normalizeOrder } from "@/lib/reorder";

describe("normalizeOrder", () => {
  it("posisi rapat 0..n sesuai urutan", () => {
    expect(normalizeOrder(["c", "a", "b"])).toEqual([
      { id: "c", position: 0 },
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ]);
  });
  it("duplikat ditolak", () => {
    expect(() => normalizeOrder(["a", "a"])).toThrow("DUPLICATE_ID");
  });
  it("daftar kosong lolos sebagai kosong", () => {
    expect(normalizeOrder([])).toEqual([]);
  });
});
