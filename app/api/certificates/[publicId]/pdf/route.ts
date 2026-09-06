import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { verifyPublicIdSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { createStrictClient as createClient } from "@/lib/supabase/server";

/**
 * GET /api/certificates/{publicId}/pdf — PDF A4 landscape resmi, on-demand.
 * Permission: murid pemilik ATAU guru cohort. Revoked → 410 tanpa dokumen valid.
 * (ADR-009: on-demand + permission check; persist ke private bucket menyusul.)
 */
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
  // RLS certificates (student own / teacher cohort) menegakkan otorisasi baca.
  const { data: cert } = await supabase
    .from("certificates")
    .select("id,status,serial_no,issued_at,payload_hash,enrollment_id,level_id")
    .eq("public_id", parsed.data.publicId)
    .single();
  const c = cert as {
    id: string;
    status: string;
    serial_no: string;
    issued_at: string;
    payload_hash: string;
    enrollment_id: string;
    level_id: string;
  } | null;
  if (!c) return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (c.status !== "active") {
    return NextResponse.json(
      { error: { code: "REVOKED", message: "Sertifikat dicabut; PDF valid tidak diterbitkan." } },
      { status: 410 },
    );
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
  const qr = await QRCode.toBuffer(`${base}/verify/${encodeURIComponent(parsed.data.publicId)}`, {
    type: "png",
    width: 180,
    margin: 1,
  });

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).stroke();
  doc.font("Helvetica").fontSize(11).fillColor("#64748b").text("SEKOLAH", { align: "center" });
  doc
    .font("Helvetica-Bold")
    .fontSize(30)
    .fillColor("#0f172a")
    .text("Certificate of Completion", { align: "center" });
  doc.moveDown();
  doc.font("Helvetica").fontSize(12).fillColor("#475569").text("Diberikan kepada", { align: "center" });
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#0f172a").text(displayName, { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(12).fillColor("#475569").text("atas penyelesaian", { align: "center" });
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#0f172a")
    .text(`${courseTitle} — ${levelTitle}`, { align: "center" });
  doc.moveDown();
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#334155")
    .text(`Tanggal terbit: ${c.issued_at}   Nomor serial: ${c.serial_no}`, { align: "center" })
    .text(`Fingerprint: ${c.payload_hash.slice(0, 12).toUpperCase()}`, { align: "center" });
  doc
    .fontSize(10)
    .fillColor("#64748b")
    .text("Pernyataan kompetensi — bukan nilai detail.", { align: "center" });
  doc.image(qr, doc.page.width - 200, doc.page.height - 200, { width: 120 });
  doc
    .fontSize(9)
    .fillColor("#64748b")
    .text("Guru: ___________________", 48, doc.page.height - 90);
  doc.end();

  const pdf = await done;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${c.serial_no}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
