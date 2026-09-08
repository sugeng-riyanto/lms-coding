import { describe, expect, it } from "vitest";
import { canvasStrokesSchema, MAX_STROKES, sanitizeCanvasStrokes, type CanvasStroke } from "@/lib/canvas";

const stroke: CanvasStroke = {
  tool: "pen",
  color: "#2563eb",
  width: 3,
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.3, y: 0.4 },
  ],
};

describe("sanitizeCanvasStrokes", () => {
  it("menerima daftar stroke valid (canonical pass-through)", () => {
    const out = sanitizeCanvasStrokes([stroke, { ...stroke, tool: "highlighter" }]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(stroke);
  });

  it("menolak stroke malformed (tool/warna/lebar/titik tak valid) → []", () => {
    expect(sanitizeCanvasStrokes("not-an-array")).toEqual([]);
    expect(sanitizeCanvasStrokes([{ tool: "brush" }])).toEqual([]);
    expect(sanitizeCanvasStrokes([{ ...stroke, color: "" }])).toEqual([]);
    expect(sanitizeCanvasStrokes([{ ...stroke, width: 0 }])).toEqual([]);
    expect(sanitizeCanvasStrokes([{ ...stroke, points: [] }])).toEqual([]);
    expect(sanitizeCanvasStrokes([{ ...stroke, points: [{ x: 1.5, y: -0.2 }] }])).toEqual([]);
  });

  it("membatasi jumlah stroke (MAX_STROKES)", () => {
    const many = Array.from({ length: MAX_STROKES + 5 }, () => stroke);
    expect(sanitizeCanvasStrokes(many)).toHaveLength(0); // schema max → invalid
    expect(canvasStrokesSchema.safeParse(Array.from({ length: MAX_STROKES }, () => stroke)).success).toBe(
      true,
    );
  });

  it("tidak pernah throw pada input apa pun", () => {
    for (const input of [null, undefined, 42, {}, [null], [{ points: [{ x: "a", y: 0 }] }]]) {
      expect(() => sanitizeCanvasStrokes(input)).not.toThrow();
    }
  });
});
