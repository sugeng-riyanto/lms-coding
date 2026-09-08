import { NextResponse, type NextRequest } from "next/server";
import { parseCspReport } from "@/lib/csp-report";
import { cspAlertState, recordCspBlocked, recordCspViolation } from "@/lib/csp-alerts";

/**
 * Endpoint laporan CSP (report-uri / report-to). Menerima body `csp-report`
 * CSP3 dari browser, mencatat pelanggaran secara ter-redaksi (tanpa query
 * string/PII/script-sample), lalu 204. Tidak pernah meng-echo body.
 *
 * Keamanan: rate-limit per IP, batas ukuran body, content-type diverifikasi,
 * log TIDAK memuat data murid (runbooks §7.2), dan event di-agregasi ke
 * lib/csp-alerts untuk alerting spike (baris `csp-alert` ACTIVE/CLEARED).
 * State transisi in-memory per proses (single instance — catatan di §7).
 */
const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

let alertWasActive = false;

/** Catat transisi spike (ACTIVE saat naik, CLEARED saat turun) — satu baris. */
function logAlertTransition(now = Date.now()): void {
  const state = cspAlertState(now);
  if (state.alertActive && !alertWasActive) {
    console.error(JSON.stringify({ type: "csp-alert", event: "ACTIVE", ...state }));
  } else if (!state.alertActive && alertWasActive) {
    console.error(JSON.stringify({ type: "csp-alert", event: "CLEARED", ...state }));
  }
  alertWasActive = state.alertActive;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || cur.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  cur.count += 1;
  return cur.count > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  if (rateLimited(clientIp(req))) {
    // Attempt yang di-block tetap dihitung — bom laporan juga tanda serangan.
    recordCspBlocked();
    logAlertTransition();
    return new NextResponse(null, { status: 429 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/csp-report") && !contentType.includes("application/json")) {
    return new NextResponse(null, { status: 415 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const report = parseCspReport(json);
  if (!report) return new NextResponse(null, { status: 204 }); // tak dikenal — diam

  // Log terstruktur, ter-redaksi. Satu baris JSON agar mudah diparsing.
  console.error(JSON.stringify({ type: "csp-violation", ...report }));
  recordCspViolation();
  logAlertTransition();
  return new NextResponse(null, { status: 204 });
}
