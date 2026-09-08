import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createStrictClient as createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * GET /api/operator/csp-digest?days=1|7 — aggregated CSP event data for operators.
 * Teachers only (same role check as /api/operator/csp-alerts).
 * Returns buckets by kind (violation/blocked). For days=1: hourly; days=7: daily.
 * No URIs, no PII — aggregate only.
 */
export async function GET(req: NextRequest) {
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

  // Parse days param: 1 (default, hourly buckets) or 7 (daily buckets).
  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam === "7" ? 7 : 1;
  const windowMs = days * 24 * 60 * 60 * 1000;

  // Read from the persisted csp_events table using the service client.
  const svc = createServiceClient();
  const since = new Date(Date.now() - windowMs).toISOString();

  const { data: events, error } = await svc
    .from("csp_events")
    .select("kind, recorded_at")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: { code: "DB_ERROR", message: error.message } }, { status: 500 });
  }

  // Bucket into intervals: hourly for 1d, daily for 7d.
  const buckets = new Map<string, { violations: number; blocked: number }>();
  for (const ev of events ?? []) {
    const d = new Date(ev.recorded_at);
    const bucketKey =
      days === 7
        ? d.toISOString().slice(0, 10) // "YYYY-MM-DD"
        : d.toISOString().slice(0, 13) + ":00:00Z"; // "YYYY-MM-DDTHH:00:00Z"
    const cur = buckets.get(bucketKey) ?? { violations: 0, blocked: 0 };
    if (ev.kind === "violation") cur.violations += 1;
    else cur.blocked += 1;
    buckets.set(bucketKey, cur);
  }

  const bucketsArr = Array.from(buckets.entries()).map(([key, counts]) => ({
    bucket: key,
    ...counts,
  }));

  const totalViolations = bucketsArr.reduce((sum, b) => sum + b.violations, 0);
  const totalBlocked = bucketsArr.reduce((sum, b) => sum + b.blocked, 0);

  return NextResponse.json({
    ok: true,
    data: {
      buckets: bucketsArr,
      total: totalViolations + totalBlocked,
      totalViolations,
      totalBlocked,
      windowDays: days,
      bucketGranularity: days === 7 ? "day" : "hour",
    },
  });
}
