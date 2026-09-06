import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

/**
 * GET /api/health — readiness lokal.
 * Tidak butuh auth; memvalidasi env server via lib/env (Zod) tanpa membocorkan nilai.
 */
export async function GET() {
  let envConfigured = true;
  let validationError: string | null = null;
  try {
    getServerEnv();
  } catch (e) {
    envConfigured = false;
    validationError = e instanceof Error ? e.message : "ENV_INVALID";
  }
  const body = {
    status: envConfigured ? "ready" : "degraded",
    timeUtc: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    envConfigured,
    validationError,
    chainAnchoring: process.env.BLOCKCHAIN_ANCHOR_ENABLED === "true",
  };
  return NextResponse.json(body, { status: envConfigured ? 200 : 503 });
}
