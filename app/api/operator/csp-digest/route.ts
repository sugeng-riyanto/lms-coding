import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createStrictClient as createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * GET /api/operator/csp-digest — 24h aggregated CSP event data for operators.
 * Teachers only (same role check as /api/operator/csp-alerts).
 * Returns hourly buckets by kind (violation/blocked) for the last 24 hours.
 * No URIs, no PII — aggregate only.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Not authenticated." } },
      { status: 401 },
    );
  }
  if (!checkRateLimit(`cspdigest:${userId}`, 10, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests." } },
      { status: 429 },
    );
  }
  const { data: rows } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active");
  const isTeacher = (rows as { role: string }[] | null)?.some((m) => m.role === "teacher");
  if (!isTeacher) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Not an operator." } }, { status: 403 });
  }

  // Read from the persisted csp_events table using the service client.
  const svc = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await svc
    .from("csp_events")
    .select("kind, recorded_at")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: { code: "DB_ERROR", message: error.message } }, { status: 500 });
  }

  // Bucket into hourly intervals.
  const buckets = new Map<string, { violations: number; blocked: number }>();
  for (const ev of events ?? []) {
    const d = new Date(ev.recorded_at);
    const hourKey = d.toISOString().slice(0, 13) + ":00:00Z";
    const cur = buckets.get(hourKey) ?? { violations: 0, blocked: 0 };
    if (ev.kind === "violation") cur.violations += 1;
    else cur.blocked += 1;
    buckets.set(hourKey, cur);
  }

  const hours = Array.from(buckets.entries()).map(([hour, counts]) => ({
    hour,
    ...counts,
  }));

  const totalViolations = hours.reduce((sum, h) => sum + h.violations, 0);
  const totalBlocked = hours.reduce((sum, h) => sum + h.blocked, 0);

  return NextResponse.json({
    ok: true,
    data: {
      hours,
      total24h: totalViolations + totalBlocked,
      totalViolations24h: totalViolations,
      totalBlocked24h: totalBlocked,
      windowHours: 24,
    },
  });
}
