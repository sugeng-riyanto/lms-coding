import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { robloxCompletionSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * POST /api/integrations/roblox/completions
 * Fase lanjutan: signed server-to-server event dengan timestamp window,
 * nonce uniqueness, rate limit. Skor TIDAK dipercaya dari client langsung.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`roblox:${ip}`, 20, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan." } },
      { status: 429 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body bukan JSON." } },
      { status: 400 },
    );
  }
  const parsed = robloxCompletionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Payload tidak valid." } },
      { status: 400 },
    );
  }
  const secret = process.env.ROBLOX_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Integrasi belum dikonfigurasi." } },
      { status: 503 },
    );
  }
  const p = parsed.data;
  const issuedAt = Date.parse(p.issued_at);
  if (Math.abs(Date.now() - issuedAt) > 5 * 60_000) {
    return NextResponse.json(
      { error: { code: "STALE_EVENT", message: "Event kedaluwarsa." } },
      { status: 400 },
    );
  }
  const canonical = [
    p.event_id,
    p.place_id,
    p.roblox_user_id,
    p.challenge_id,
    String(p.score),
    p.issued_at,
    p.nonce,
  ].join("|");
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(p.signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { error: { code: "BAD_SIGNATURE", message: "Signature tidak valid." } },
      { status: 401 },
    );
  }
  // TODO: simpan append-only receipt + nonce uniqueness di Postgres (migration fase lanjutan).
  return NextResponse.json({
    ok: true,
    stored: false,
    note: "Signature valid; persistensi menunggu migration receipts.",
  });
}
