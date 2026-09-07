import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { verifyPublicIdSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { createStrictClient as createClient } from "@/lib/supabase/server";
import { createPdfSignedUrl, persistPdf } from "@/lib/certificate-store";

/**
 * GET /api/certificates/{publicId}/pdf — official A4-landscape PDF, generated on demand.
 * Permission: the recipient student OR a teacher of the course cohort. Revoked → 410 with
 * no valid document issued. (ADR-009: on-demand generation + permission check.)
 *
 * The document is TWO inseparable pages:
 *  - Page 1: certificate face (recipient, course, level, serial, signature, QR).
 *  - Page 2: general information + aggregate completion statistics (real-data
 *    charts), carrying the SAME QR code and unique code as page 1 — scanning
 *    either page opens the same /verify/{publicId} page.
 *
 * Per-module content completeness is intentionally NOT printed: the detailed
 * breakdown lives on the certificate's web record (authorized /verify panel +
 * machine-readable JSON record), so the fixed 2-page document can never overflow
 * no matter how many modules a level has.
 */

type CertRow = {
  id: string;
  status: string;
  serial_no: string;
  issued_at: string;
  payload_hash: string;
  enrollment_id: string;
  level_id: string;
  pdf_path: string | null;
};

type ModuleRow = { id: string; title: string; position: number };
type LessonRow = { id: string; module_id: string; title: string; position: number; required: boolean };
type ActivityRow = {
  id: string;
  lesson_id: string;
  type: string;
  title: string;
  position: number;
  required: boolean;
};

/** Loads the level hierarchy + progress used on page 2 (all read through the RLS viewer). */
async function loadCompletenessData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollmentId: string,
  levelId: string,
) {
  const { data: modulesData } = await supabase
    .from("modules")
    .select("id,title,position")
    .eq("level_id", levelId)
    .order("position");
  const modules = (modulesData ?? []) as ModuleRow[];

  const moduleIds = modules.map((m) => m.id);
  let lessons: LessonRow[] = [];
  if (moduleIds.length > 0) {
    const { data: lessonsData } = await supabase
      .from("lessons")
      .select("id,module_id,title,position,required")
      .in("module_id", moduleIds)
      .order("position");
    lessons = (lessonsData ?? []) as LessonRow[];
  }

  const lessonIds = lessons.map((l) => l.id);
  let activities: ActivityRow[] = [];
  if (lessonIds.length > 0) {
    const { data: activitiesData } = await supabase
      .from("activities")
      .select("id,lesson_id,type,title,position,required")
      .in("lesson_id", lessonIds)
      .order("position");
    activities = (activitiesData ?? []) as ActivityRow[];
  }

  // Completed lessons — from this level's progress_snapshots (completed / percent 100).
  const completedLessonIds = new Set<string>();
  if (lessonIds.length > 0) {
    const { data: snaps } = await supabase
      .from("progress_snapshots")
      .select("entity_id,status,percent")
      .eq("enrollment_id", enrollmentId)
      .eq("entity_type", "lesson")
      .in("entity_id", lessonIds);
    for (const s of (snaps ?? []) as { entity_id: string; status: string; percent: number }[]) {
      if (s.status === "completed" || Number(s.percent) >= 100) completedLessonIds.add(s.entity_id);
    }
  }

  // Completed activities — append-only activity_completed events (incl. submitted quizzes).
  const completedActivityIds = new Set<string>();
  if (activities.length > 0) {
    const { data: events } = await supabase
      .from("learning_events")
      .select("entity_id")
      .eq("enrollment_id", enrollmentId)
      .eq("event_type", "activity_completed")
      .eq("entity_type", "activity")
      .in(
        "entity_id",
        activities.map((a) => a.id),
      );
    for (const ev of (events ?? []) as { entity_id: string }[]) completedActivityIds.add(ev.entity_id);
  }

  // Assessments on this level + best attempt.
  const activityIds = activities.map((a) => a.id);
  let assessmentCount = 0;
  let submittedAttempts = 0;
  let bestScore: number | null = null;
  if (activityIds.length > 0) {
    const { data: assessments } = await supabase
      .from("assessments")
      .select("id,activity_id")
      .in("activity_id", activityIds);
    const assessmentIds = ((assessments ?? []) as { id: string; activity_id: string }[]).map((a) => a.id);
    assessmentCount = assessmentIds.length;
    if (assessmentIds.length > 0) {
      const { data: attempts } = await supabase
        .from("attempts")
        .select("final_score,status")
        .eq("enrollment_id", enrollmentId)
        .in("assessment_id", assessmentIds);
      for (const a of (attempts ?? []) as { final_score: number | null; status: string }[]) {
        if (a.status !== "submitted" || a.final_score == null) continue;
        submittedAttempts += 1;
        if (bestScore == null || a.final_score > bestScore) bestScore = a.final_score;
      }
    }
  }

  // Active study time (server-clamped heartbeats).
  let activeSeconds = 0;
  {
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("active_seconds")
      .eq("enrollment_id", enrollmentId);
    for (const s of (sessions ?? []) as { active_seconds: number }[]) activeSeconds += s.active_seconds;
  }

  return {
    modules,
    lessons,
    activities,
    completedLessonIds,
    completedActivityIds,
    assessmentCount,
    submittedAttempts,
    bestScore,
    activeSeconds,
  };
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h} hr ${m} min`;
  if (h > 0) return `${h} hr`;
  return `${m} min`;
}

type TableRow = (string | number)[];

/** Draws a simple table; returns the y coordinate after the last row. */
function drawTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  headers: string[],
  rows: TableRow[],
  widths: number[],
  opts: { rowH?: number; headerH?: number; align?: ("left" | "center" | "right")[] } = {},
): number {
  const rowH = opts.rowH ?? 20;
  const headerH = opts.headerH ?? 22;
  const align = opts.align ?? headers.map(() => "left");
  const totalW = widths.reduce((a, b) => a + b, 0);

  const drawCell = (text: string, cy: number, ch: number, i: number, bold: boolean, fill?: string) => {
    const w = widths[i] ?? 0;
    const x0 = x + widths.slice(0, i).reduce((a, b) => a + b, 0);
    if (fill) {
      doc.rect(x0, cy, w, ch).fill(fill);
      doc.fillColor("#0f172a");
    }
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor("#0f172a")
      .text(String(text), x0 + 6, cy + 5, {
        width: Math.max(w - 12, 40),
        align: align[i] ?? "left",
        lineBreak: false,
      });
  };

  // Header row: light indigo gradient fill with navy text — reads as a clean
  // light band when printed in grayscale.
  const hdrGrad = doc.linearGradient(x, y, x + totalW, y);
  hdrGrad.stop(0, "#eef2ff").stop(0.5, "#e0e7ff").stop(1, "#dbeafe");
  doc.rect(x, y, totalW, headerH).fill(hdrGrad);
  for (let i = 0; i < headers.length; i += 1) {
    const cx = x + widths.slice(0, i).reduce((a, b) => a + b, 0);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#1e3a8a")
      .text(String(headers[i] ?? ""), cx + 6, y + 5, {
        width: Math.max((widths[i] ?? 0) - 12, 40),
        align: align[i] ?? "left",
        lineBreak: false,
      });
  }
  doc.rect(x, y, totalW, headerH).lineWidth(0.6).strokeColor("#c7d2fe").stroke();
  y += headerH;

  rows.forEach((row, ri) => {
    const fill = ri % 2 === 1 ? "#f8fafc" : undefined;
    drawCell(String(row[0] ?? ""), y, rowH, 0, false, fill);
    for (let i = 1; i < row.length; i += 1) {
      const cx = x + widths.slice(0, i).reduce((a, b) => a + b, 0);
      if (fill) doc.rect(cx, y, widths[i] ?? 0, rowH).fill(fill);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#0f172a")
        .text(String(row[i] ?? ""), cx + 6, y + 5, {
          width: Math.max((widths[i] ?? 0) - 12, 40),
          align: align[i] ?? "left",
          lineBreak: false,
        });
    }
    doc.rect(x, y, totalW, rowH).lineWidth(0.4).strokeColor("#cbd5e1").stroke();
    y += rowH;
  });
  return y;
}

/** Draws one chart row: label, horizontal completion bar, right-aligned value. */
function drawBarRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  labelW: number,
  barX: number,
  barW: number,
  valueX: number,
  valueW: number,
  barH: number,
  label: string,
  value: string,
  pct: number | null,
): void {
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#334155")
    .text(label, x, y + 1, {
      width: labelW,
      lineBreak: false,
    });
  if (pct != null) {
    const p = Math.min(Math.max(pct, 0), 100);
    // track
    doc.rect(barX, y, barW, barH).fill("#e2e8f0");
    // gradient fill — completion is real data, never decorative
    const fillW = (p / 100) * barW;
    if (fillW > 1) {
      const grad = doc.linearGradient(barX, y, barX + fillW, y);
      grad.stop(0, "#2563eb");
      grad.stop(1, "#60a5fa");
      doc.rect(barX, y, fillW, barH).fill(grad);
    }
    doc.rect(barX, y, barW, barH).lineWidth(0.5).strokeColor("#94a3b8").stroke();
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#0f172a")
    .text(value, valueX, y + 1, { width: valueW, lineBreak: false, align: "left" });
}

export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;
  const parsed = verifyPublicIdSchema.safeParse({ publicId });
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_ID", message: "ID tidak valid." } }, { status: 400 });
  }
  if (!checkRateLimit(`pdf:${parsed.data.publicId.slice(0, 8)}`, 10, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan." } },
      { status: 429 },
    );
  }
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!(claimsData?.claims as { sub?: string } | undefined)?.sub) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Belum masuk." } },
      { status: 401 },
    );
  }
  // RLS on certificates (own student / cohort teacher) enforces read authorization.
  const { data: cert } = await supabase
    .from("certificates")
    .select("id,status,serial_no,issued_at,payload_hash,enrollment_id,level_id,pdf_path")
    .eq("public_id", parsed.data.publicId)
    .single();
  const c = cert as CertRow | null;
  if (!c) return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (c.status !== "active") {
    return NextResponse.json(
      { error: { code: "REVOKED", message: "Sertifikat dicabut; PDF valid tidak diterbitkan." } },
      { status: 410 },
    );
  }
  // Persisted PDF → short-lived signed URL (permission sudah dipaksa RLS di atas).
  if (c.pdf_path) {
    const signed = await createPdfSignedUrl(c.pdf_path, 300);
    if (signed) return NextResponse.redirect(signed, 302);
    // signed URL gagal → fall through ke render on-demand (degradasi anggun).
  }
  const { data: enr } = await supabase
    .from("enrollments")
    .select("student_id,course_id")
    .eq("id", c.enrollment_id)
    .single();
  const e = enr as { student_id: string; course_id: string } | null;
  const { data: prof } = e
    ? await supabase.from("profiles").select("display_name").eq("id", e.student_id).single()
    : { data: null };
  const { data: course } = e
    ? await supabase.from("courses").select("title").eq("id", e.course_id).single()
    : { data: null };
  const { data: level } = await supabase.from("levels").select("title").eq("id", c.level_id).single();

  const displayName = (prof as { display_name: string } | null)?.display_name ?? "—";
  const courseTitle = (course as { title: string } | null)?.title ?? "—";
  const levelTitle = (level as { title: string } | null)?.title ?? "—";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${base}/verify/${encodeURIComponent(parsed.data.publicId)}`;
  // QR buffers encode the SAME verify URL (identical code) on both pages. Page 2
  // uses a smaller source buffer so downscaling to 33.75pt keeps modules crisp
  // enough to stay scannable.
  const qr = await QRCode.toBuffer(verifyUrl, { type: "png", width: 180, margin: 1 });
  const qrSmall = await QRCode.toBuffer(verifyUrl, { type: "png", width: 72, margin: 1 });

  const stats = await loadCompletenessData(supabase, c.enrollment_id, c.level_id);

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // ================= Page 1 — certificate face =================
  const W1 = doc.page.width;
  const H1 = doc.page.height;

  // Rounded outer frame — subtle radius keeps the document elegant in print.
  const R_OUTER = 16;
  const R_INNER = 8;

  // Everything decorative is clipped to the rounded frame so the background wash
  // and ribbons follow the corner radius instead of poking out of it.
  doc.save();
  doc.roundedRect(24, 24, W1 - 48, H1 - 48, R_OUTER).clip();

  const bgGrad = doc.linearGradient(24, 24, 24, H1 - 24);
  bgGrad.stop(0, "#ffffff").stop(0.55, "#f6f9ff").stop(1, "#e8effc");
  doc.rect(24, 24, W1 - 48, H1 - 48).fill(bgGrad);

  // Gradient ribbons (navy → blue → sky) top & bottom — colour that separates into
  // a clean dark→mid band even in grayscale printing.
  const ribbonTop = doc.linearGradient(24, 32, W1 - 24, 32);
  ribbonTop.stop(0, "#1e3a8a").stop(0.5, "#2563eb").stop(1, "#38bdf8");
  doc.rect(24, 32, W1 - 48, 10).fill(ribbonTop);
  const ribbonBottom = doc.linearGradient(24, H1 - 42, W1 - 24, H1 - 42);
  ribbonBottom.stop(0, "#38bdf8").stop(0.5, "#2563eb").stop(1, "#1e3a8a");
  doc.rect(24, H1 - 42, W1 - 48, 10).fill(ribbonBottom);

  doc.restore();

  // Rounded double frame: outer hairline + inset accent line.
  doc
    .roundedRect(24, 24, W1 - 48, H1 - 48, R_OUTER)
    .lineWidth(1)
    .strokeColor("#cbd5e1")
    .stroke();
  doc
    .roundedRect(29, 29, W1 - 58, H1 - 58, R_INNER)
    .lineWidth(0.75)
    .strokeColor("#dbe3f0")
    .stroke();

  doc.font("Helvetica").fontSize(11).fillColor("#475569").text("ACADEMY", { align: "center" });
  doc
    .font("Helvetica-Bold")
    .fontSize(30)
    .fillColor("#1e3a8a")
    .text("Certificate of Completion", { align: "center" });
  // Gradient underline beneath the title.
  const titleUnderline = doc.linearGradient(W1 / 2 - 180, doc.y + 9, W1 / 2 + 180, doc.y + 9);
  titleUnderline.stop(0, "#1e3a8a").stop(0.5, "#2563eb").stop(1, "#38bdf8");
  doc.rect(W1 / 2 - 180, doc.y + 9, 360, 3.5).fill(titleUnderline);
  doc.moveDown(1.35);
  doc.fillColor("#0f172a");
  doc.font("Helvetica").fontSize(12).fillColor("#475569").text("Presented to", { align: "center" });
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#0f172a").text(displayName, { align: "center" });
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor("#475569")
    .text("for the successful completion of", { align: "center" });
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#1e3a8a")
    .text(`${courseTitle} — ${levelTitle}`, { align: "center" });
  doc.moveDown(1.1);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#334155")
    .text(`Date of issue: ${c.issued_at}   Serial number: ${c.serial_no}`, { align: "center" })
    .text(`Fingerprint: ${c.payload_hash.slice(0, 12).toUpperCase()}`, { align: "center" });
  doc
    .fontSize(10)
    .fillColor("#64748b")
    .text("This certificate attests to demonstrated competence; detailed scores are not disclosed.", {
      align: "center",
    });
  doc.image(qr, doc.page.width - 200, doc.page.height - 200, { width: 120 });
  // Digital signature area — the authorised signatory's name below the line.
  const sigY = doc.page.height - 96;
  doc.moveTo(56, sigY).lineTo(236, sigY).lineWidth(1).strokeColor("#94a3b8").stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text("Sugeng Riyanto, M.Sc.", 56, sigY + 8);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#64748b")
    .text("Certificate Issuer", 56, sigY + 26);

  // ================= Page 2 — general information & content completeness =================
  doc.addPage({ size: "A4", layout: "landscape", margin: 48 });
  const W = doc.page.width;
  const H = doc.page.height;
  const maxY = H - 48; // pdfkit auto-inserts a page whenever a line crosses this bound.

  // Rounded outer frame (radius matching page 1) so both pages read as one document.
  doc
    .roundedRect(24, 24, W - 48, H - 48, 16)
    .lineWidth(1)
    .strokeColor("#cbd5e1")
    .stroke();
  doc
    .roundedRect(29, 29, W - 58, H - 58, 8)
    .lineWidth(0.75)
    .strokeColor("#dbe3f0")
    .stroke();

  // Small QR in the top-right corner — identical to page 1's buffer, kept clear of the
  // centred title so no overlap occurs.
  const qrSize = 42.1875; // naik 25% dari 33.75 (50% dari 67.5 sebelumnya)
  doc.image(qrSmall, W - 24 - qrSize - 16, 40, { width: qrSize });

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#0f172a")
    .text("General Information & Completion Summary", 48, 48, {
      align: "center",
      width: W - 96 - qrSize - 16,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#64748b")
    .text("Page 2 of 2 — an integral part of page 1 of this certificate.", 48, 74, {
      align: "center",
      width: W - 96 - qrSize - 16,
    });
  // Gradient accent line beneath the page-2 header (small, decorative).
  const p2Accent = doc.linearGradient(W / 2 - 170, 96, W / 2 + 170, 96);
  p2Accent.stop(0, "#1e3a8a").stop(0.5, "#2563eb").stop(1, "#38bdf8");
  doc.rect(W / 2 - 170, 96, 340, 3).fill(p2Accent);

  // --- General information table ---
  const infoRows: TableRow[] = [
    ["Recipient", displayName, "Issuer", "Sugeng Riyanto, M.Sc."],
    ["Course", courseTitle, "Level", levelTitle],
    ["Serial number", c.serial_no, "Unique code (public ID)", parsed.data.publicId],
    ["Date of issue", c.issued_at, "Fingerprint", c.payload_hash.slice(0, 12).toUpperCase()],
  ];
  let y = drawTable(doc, 56, 104, ["Field", "Value", "Field", "Value"], infoRows, [115, 255, 115, 255], {
    rowH: 20,
    headerH: 20,
    align: ["left", "left", "left", "left"],
  });
  y += 12;

  // --- Completion statistics with real-data charts ---
  // Per-module completeness is deliberately NOT printed here: the detailed
  // breakdown lives on the certificate's web record (authorized /verify panel and
  // the public JSON record), where it can never overflow this 2-page document.
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#64748b")
    .text(
      "Per-module content completeness is available in this certificate's online digital record, not on paper.",
      56,
      y,
      { width: W - 112, align: "left" },
    );
  y += 16;
  const requiredLessons = stats.lessons.filter((l) => l.required);
  const requiredActs = stats.activities.filter((a) => a.required);
  const lessonsDone = stats.lessons.filter((l) => stats.completedLessonIds.has(l.id)).length;
  const actsDone = stats.activities.filter((a) => stats.completedActivityIds.has(a.id)).length;
  const contentPct =
    requiredLessons.length + requiredActs.length > 0
      ? Math.round(((lessonsDone + actsDone) / (requiredLessons.length + requiredActs.length)) * 100)
      : 100;

  const assessmentCell =
    stats.assessmentCount === 0
      ? "—"
      : stats.submittedAttempts > stats.assessmentCount
        ? `${stats.assessmentCount} assessment${stats.assessmentCount === 1 ? "" : "s"} (${stats.submittedAttempts} attempt${stats.submittedAttempts === 1 ? "" : "s"})`
        : `${stats.submittedAttempts}/${stats.assessmentCount}`;

  type ChartRow = { label: string; value: string; pct: number | null };
  const chartRows: ChartRow[] = [
    { label: "Level content completed", value: `${contentPct}%`, pct: contentPct },
    {
      label: "Lessons completed",
      value: `${lessonsDone}/${requiredLessons.length}`,
      pct: requiredLessons.length > 0 ? (lessonsDone / requiredLessons.length) * 100 : 100,
    },
    {
      label: "Activities completed",
      value: `${actsDone}/${requiredActs.length}`,
      pct: requiredActs.length > 0 ? (actsDone / requiredActs.length) * 100 : 100,
    },
    ...(stats.bestScore != null
      ? [{ label: "Best assessment score", value: `${Math.round(stats.bestScore)}%`, pct: stats.bestScore }]
      : []),
    ...(stats.assessmentCount > 0
      ? [{ label: "Summative assessment", value: assessmentCell, pct: null }]
      : []),
    { label: "Active study time", value: formatDuration(stats.activeSeconds), pct: null },
  ];

  // Keep every element above maxY so pdfkit never inserts a phantom page, and reserve
  // the lower band for the footer.
  if (y < maxY - 210) {
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Completion Statistics", 56, y);
    y += 24;

    const labelW = 175;
    const barW = 300;
    const barX = 56 + labelW + 12;
    const valueX = barX + barW + 12;
    const valueW = 200;
    const avail = H - 150 - y;
    const rowGap = 10;
    const barH =
      chartRows.length > 0 && avail > chartRows.length * (rowGap + 6)
        ? Math.min(14, Math.max(7, Math.floor(avail / chartRows.length) - rowGap))
        : 0;
    if (barH >= 7) {
      for (const row of chartRows) {
        drawBarRow(doc, 56, y, labelW, barX, barW, valueX, valueW, barH, row.label, row.value, row.pct);
        y += barH + rowGap;
      }
    }
  }

  // --- Page-2 footer: no QR (moved top-right); codes identical to page 1 ---
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#64748b")
    .text(
      "The QR code and unique code on this page are identical to those on page 1 — scanning either page " +
        "verifies the same certificate.",
      56,
      H - 146,
      { align: "center", width: W - 112 },
    );
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text(`Unique code: ${parsed.data.publicId}`, 56, H - 124, { align: "center", width: W - 112 });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#334155")
    .text(`Serial number: ${c.serial_no}   •   Verify: ${verifyUrl}`, 56, H - 104, {
      align: "center",
      width: W - 112,
    });
  // Positioned at H-64 (not H-56): a line at H-56 would cross maxY = H-48 and make
  // pdfkit append an empty third page (reproduced & fixed earlier).
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#94a3b8")
    .text("Page 2 of 2", 56, H - 64, { align: "center", width: W - 112 });

  doc.end();

  const pdf = await done;

  // Render sekali lalu simpan (best-effort): kalau storage tak tersedia/gagal,
  // respons PDF-stream tetap jalan & pdf_path tetap null (perilaku lama).
  try {
    await persistPdf(parsed.data.publicId, pdf);
  } catch {
    // best-effort — jangan gagalkan unduhan karena persist gagal.
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${c.serial_no}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
