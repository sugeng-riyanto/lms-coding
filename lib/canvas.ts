/**
 * Kanvas anotasi sains/math — format stroke + validasi (single source).
 *
 * Satu kanvas = daftar stroke. Satu stroke = tool + warna + lebar + jalur titik
 * (koordinat normal 0..1 relatif ukuran kanvas, sehingga replay stabil saat
 * ukuran elemen berubah). Semua angka dibatasi di server: jumlah stroke,
 * jumlah titik per stroke, lebar. Tool 'eraser' memakai komposit destination-out
 * saat replay (bukan menyimpan PNG) — data tetap JSON murni, bisa diaudit.
 */
import { z } from "zod";

export const CANVAS_TOOLS = ["pen", "highlighter", "eraser"] as const;
export type CanvasTool = (typeof CANVAS_TOOLS)[number];

export const CANVAS_ROLES = ["student", "teacher"] as const;
export type CanvasRole = (typeof CANVAS_ROLES)[number];

export const MAX_STROKES = 2_000;
export const MAX_POINTS_PER_STROKE = 20_000;

export const canvasStrokeSchema = z.object({
  tool: z.enum(CANVAS_TOOLS),
  color: z.string().min(1).max(30),
  width: z.number().min(1).max(60),
  points: z
    .array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }))
    .min(1)
    .max(MAX_POINTS_PER_STROKE),
});

export const canvasStrokesSchema = z.array(canvasStrokeSchema).max(MAX_STROKES);

export type CanvasStroke = z.infer<typeof canvasStrokeSchema>;

/** Validasi + normalisasi strokes. Input tak valid → [] (tidak pernah throw). */
export function sanitizeCanvasStrokes(input: unknown): CanvasStroke[] {
  const parsed = canvasStrokesSchema.safeParse(input);
  if (!parsed.success) return [];
  return parsed.data;
}
