"use client";

/**
 * Kanvas anotasi sains/math (murid menjawab, guru umpan balik).
 *
 * Data = daftar stroke JSON (lib/canvas.ts): tool + warna + lebar + titik
 * ternormalisasi 0..1 relatif ukuran kanvas → replay stabil saat resize.
 * Disimpan otomatis (debounce) via saveCanvasStrokes; role ditentukan SERVER
 * (action memetakan caller → student/teacher), readOnly untuk mode baca
 * (murid setelah submit / guru melihat kanvas murid).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getCanvasStrokes, saveCanvasStrokes } from "@/features/actions";
import { mkT, type Lang } from "@/lib/i18n";
import { CANVAS } from "@/lib/ui-text/canvas";
import type { CanvasRole, CanvasStroke, CanvasTool } from "@/lib/canvas";
import { MAX_STROKES } from "@/lib/canvas";

const COLORS = ["#1e293b", "#2563eb", "#dc2626", "#16a34a", "#eab308"];
const LOGICAL_HEIGHT = 380;

interface Props {
  attemptId: string;
  questionVersionId: string;
  lang: Lang;
  role: CanvasRole;
  readOnly?: boolean;
  /** Strokes awal (mis. kanvas murid yang dibaca guru) — lewati fetch. */
  initialStrokes?: CanvasStroke[];
  /** Label judul kartu; default dari kamus per peran. */
  title?: string;
}

export function CanvasPad({
  attemptId,
  questionVersionId,
  lang,
  role,
  readOnly = false,
  initialStrokes,
  title,
}: Props) {
  const t = mkT(CANVAS, lang);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [strokes, setStrokes] = useState<CanvasStroke[]>(initialStrokes ?? []);
  const [tool, setTool] = useState<CanvasTool>("pen");
  const [color, setColor] = useState<string>(COLORS[0] ?? "#1e293b");
  const [width, setWidth] = useState(3);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const drawing = useRef<CanvasStroke | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strokesRef = useRef<CanvasStroke[]>([]);
  // Sinkronkan ref dengan state SETELAH render (bukan saat render).
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const replay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    for (const s of strokesRef.current) {
      ctx.save();
      if (s.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
      else if (s.tool === "highlighter") ctx.globalAlpha = 0.35;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.tool === "highlighter" ? s.width * 3 : s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * w;
        const y = p.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  // Resize: sesuaikan backing store (DPR) dan replay ulang stroke ternormalisasi.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = LOGICAL_HEIGHT;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      replay();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [replay]);

  // Muat kanvas milik peran ini (jika tidak disuplai dari luar).
  useEffect(() => {
    if (initialStrokes) return; // state diinisialisasi dari prop saat mount
    let alive = true;
    void getCanvasStrokes({ attemptId, questionVersionId }).then((res) => {
      if (!alive || !res.ok) return;
      setStrokes(res[role]);
    });
    return () => {
      alive = false;
    };
  }, [attemptId, questionVersionId, role, initialStrokes]);

  const scheduleSave = useCallback(
    (next: CanvasStroke[]) => {
      if (readOnly) return;
      setStatus("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveCanvasStrokes({ attemptId, questionVersionId, strokes: next }).then((res) => {
          setStatus(res.ok ? "saved" : "failed");
        });
      }, 800);
    },
    [attemptId, questionVersionId, readOnly],
  );

  function localPoint(e: React.PointerEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (readOnly) return;
    e.preventDefault();
    const p = localPoint(e);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = { tool, color, width, points: [p] };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drawing.current;
    if (!d) return;
    const p = localPoint(e);
    if (!p) return;
    d.points.push(p);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.save();
    if (d.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
    else if (d.tool === "highlighter") ctx.globalAlpha = 0.35;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.tool === "highlighter" ? d.width * 3 : d.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const prev = d.points[d.points.length - 2];
    if (prev) {
      ctx.moveTo(prev.x * w, prev.y * h);
      ctx.lineTo(p.x * w, p.y * h);
    }
    ctx.stroke();
    ctx.restore();
  }

  function onPointerUp() {
    const d = drawing.current;
    drawing.current = null;
    if (!d || d.points.length === 0) return;
    const next = [...strokesRef.current, d];
    if (next.length > MAX_STROKES) next.shift();
    setStrokes(next);
    scheduleSave(next);
  }

  function onUndo() {
    const next = strokesRef.current.slice(0, -1);
    setStrokes(next);
    scheduleSave(next);
    requestAnimationFrame(replay);
  }

  function onClear() {
    const next: CanvasStroke[] = [];
    setStrokes(next);
    scheduleSave(next);
    requestAnimationFrame(replay);
  }

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const statusLabel =
    status === "saving"
      ? t("saving")
      : status === "saved"
        ? t("saved")
        : status === "failed"
          ? t("saveFailed")
          : "";

  const shownTitle = title ?? (role === "student" ? t("titleStudent") : t("titleFeedback"));

  return (
    <div className="space-y-2">
      {shownTitle ? <p className="text-sm font-semibold">{shownTitle}</p> : null}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
            {(["pen", "highlighter", "eraser"] as const).map((tk) => (
              <button
                key={tk}
                type="button"
                aria-pressed={tool === tk}
                onClick={() => setTool(tk)}
                className={`px-3 py-1.5 ${
                  tool === tk
                    ? "bg-blue-700 font-semibold text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                {tk === "pen" ? t("pen") : tk === "highlighter" ? t("highlighter") : t("eraser")}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-500">{t("colors")}</span>
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-blue-700" : "border-slate-300"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
            {t("width")}
            <input
              type="range"
              min={1}
              max={12}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-20"
            />
          </label>
          <button
            type="button"
            onClick={onUndo}
            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100 dark:border-slate-600"
          >
            {t("undo")}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
          >
            {t("clear")}
          </button>
          {statusLabel && (
            <span
              role="status"
              className={`text-xs ${status === "failed" ? "text-red-700" : "text-slate-500"}`}
            >
              {statusLabel}
            </span>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900 ${
          readOnly ? "" : "cursor-crosshair"
        }`}
      >
        <canvas
          ref={canvasRef}
          aria-label={shownTitle}
          className="block touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {strokes.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-2 px-3 text-center text-xs text-slate-400">
            {readOnly ? t("readonlyHint") : t("emptyHint")}
          </p>
        )}
      </div>
    </div>
  );
}
