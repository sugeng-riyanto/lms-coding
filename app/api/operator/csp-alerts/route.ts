import { NextResponse } from "next/server";
import { createStrictClient as createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { cspAlertState } from "@/lib/csp-alerts";

/**
 * GET /api/operator/csp-alerts — state agregat alerting CSP untuk operator
 * (dashboard/uptime). Hanya guru aktif (RLS + cek eksplisit). HANYA nilai
 * agregat: jumlah/rate/sample/threshold — TIDAK pernah URI, directive detail,
 * script-sample, atau PII (min disclosure). Lihat DEPLOYMENT.md §7.3.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Belum masuk." } },
      { status: 401 },
    );
  }
  if (!checkRateLimit(`cspalerts:${userId}`, 20, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan." } },
      { status: 429 },
    );
  }
  // Role dari membership server-side (bukan client metadata).
  const { data: rows } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active");
  const isTeacher = (rows as { role: string }[] | null)?.some((m) => m.role === "teacher");
  if (!isTeacher) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Bukan operator." } }, { status: 403 });
  }

  return NextResponse.json({ ok: true, data: cspAlertState() });
}
