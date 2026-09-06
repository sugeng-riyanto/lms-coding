import { NextResponse } from "next/server";

/**
 * GET /api/health — readiness lokal.
 * Tidak butuh auth; tidak membocorkan secret, hanya boolean kesiapan env.
 */
export async function GET() {
  const envConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const body = {
    status: envConfigured ? "ready" : "degraded",
    timeUtc: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    envConfigured,
    chainAnchoring: process.env.BLOCKCHAIN_ANCHOR_ENABLED === "true",
  };
  return NextResponse.json(body, { status: envConfigured ? 200 : 503 });
}
