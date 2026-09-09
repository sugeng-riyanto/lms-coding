import { describe, expect, it } from "vitest";
import { saveCatalogOrderSchema } from "@/lib/validation";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("saveCatalogOrderSchema boundary", () => {
  it("menerima scope valid + array uuid ≥1", () => {
    for (const scope of ["student_catalog", "teacher_courses"] as const) {
      expect(saveCatalogOrderSchema.safeParse({ scope, orderedIds: [UUID] }).success).toBe(true);
      expect(
        saveCatalogOrderSchema.safeParse({
          scope,
          orderedIds: [UUID, "22222222-2222-2222-2222-222222222222"],
        }).success,
      ).toBe(true);
    }
  });

  it("menolak scope di luar enum (RBAC)", () => {
    const r = saveCatalogOrderSchema.safeParse({ scope: "admin_catalog", orderedIds: [UUID] });
    expect(r.success).toBe(false);
  });

  it("menolak orderedIds kosong / >200 / bukan uuid", () => {
    expect(saveCatalogOrderSchema.safeParse({ scope: "student_catalog", orderedIds: [] }).success).toBe(false);
    const many = Array.from({ length: 201 }, () => UUID);
    expect(saveCatalogOrderSchema.safeParse({ scope: "student_catalog", orderedIds: many }).success).toBe(false);
    expect(
      saveCatalogOrderSchema.safeParse({ scope: "student_catalog", orderedIds: ["not-a-uuid"] }).success,
    ).toBe(false);
    expect(saveCatalogOrderSchema.safeParse({ scope: "student_catalog", orderedIds: [123] }).success).toBe(false);
  });

  it("menolak payload non-objek / field hilang", () => {
    expect(saveCatalogOrderSchema.safeParse(null).success).toBe(false);
    expect(saveCatalogOrderSchema.safeParse({ scope: "student_catalog" }).success).toBe(false);
    expect(saveCatalogOrderSchema.safeParse({ orderedIds: [UUID] }).success).toBe(false);
  });
});