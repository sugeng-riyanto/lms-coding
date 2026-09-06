import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { verifyPublicIdSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";

/** GET /api/certificates/{publicId}/qr → PNG QR menuju HTTPS verifier. */
export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;
  const parsed = verifyPublicIdSchema.safeParse({ publicId });
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_ID", message: "ID tidak valid." } }, { status: 400 });
  }
  if (!checkRateLimit(`qr:${parsed.data.publicId.slice(0, 8)}`, 30, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan." } },
      { status: 429 },
    );
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${base}/verify/${encodeURIComponent(parsed.data.publicId)}`;
  const png = await QRCode.toBuffer(url, { type: "png", width: 256, margin: 1 });
  const buf = new Uint8Array(png);
  return new NextResponse(buf, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
