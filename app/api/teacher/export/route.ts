import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * GET /api/teacher/export?cohortId=… — CSV nilai & progress cohort sendiri.
 * Permission = filter UI (guru cohort). Sel anti formula-injection via lib/csv.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cohortId = url.searchParams.get("cohortId") ?? "";
  if (!cohortId) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "cohortId wajib." } },
      { status: 400 },
    );
  }
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Belum masuk." } },
      { status: 401 },
    );
  }
  if (!checkRateLimit(`export:${userId}`, 5, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan." } },
      { status: 429 },
    );
  }
  // Cohort harus milik guru (RLS + cek eksplisit).
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id,name")
    .eq("id", cohortId)
    .eq("teacher_id", userId)
    .single();
  if (!cohort) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Bukan cohort Anda." } },
      { status: 403 },
    );
  }
  const { data: members } = await supabase
    .from("cohort_members")
    .select("student_id")
    .eq("cohort_id", cohortId);
  const rows: (string | number)[][] = [];
  for (const m of (members as { student_id: string }[] | null) ?? []) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", m.student_id)
      .single();
    const { data: enrs } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", m.student_id)
      .eq("cohort_id", cohortId);
    for (const e of (enrs as { id: string }[] | null) ?? []) {
      const { data: snaps } = await supabase
        .from("progress_snapshots")
        .select("percent")
        .eq("enrollment_id", e.id)
        .eq("entity_type", "lesson");
      const ss = (snaps as { percent: number }[] | null) ?? [];
      const avg = ss.length > 0 ? ss.reduce((a, s) => a + Number(s.percent), 0) / ss.length : 0;
      const { data: atts } = await supabase
        .from("attempts")
        .select("final_score")
        .eq("enrollment_id", e.id)
        .not("final_score", "is", null);
      const best = Math.max(
        0,
        ...((atts as { final_score: number }[] | null) ?? []).map((a) => Number(a.final_score)),
      );
      rows.push([
        (prof as { display_name: string } | null)?.display_name ?? m.student_id.slice(0, 8),
        Math.round(avg),
        best,
      ]);
    }
  }
  const csv = toCsv(["Nama", "Progress", "SkorTerbaik"], rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cohort-${cohortId.slice(0, 8)}.csv"`,
    },
  });
}
