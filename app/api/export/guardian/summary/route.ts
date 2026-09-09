import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { checkRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/guardian/summary — CSV ringkasan anak tertaut (wali).
 * Kapabilitas `view_linked_child_summary`: hanya anak dengan guardian link
 * aktif. Data yang sama dengan dashboard wali (profil, enrollment, progres,
 * sertifikat) — TANPA jawaban/nilai rinci. RLS + filter eksplisit.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId") ?? "";
  if (!studentId) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "studentId wajib." } },
      { status: 400 },
    );
  }
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Not signed in." } },
      { status: 401 },
    );
  }
  if (!checkRateLimit(`guardian-summary:${userId}`, 5, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests." } },
      { status: 429 },
    );
  }

  // Harus wali dengan guardian link AKTIF ke studentId (RLS guardian_links).
  const { data: link } = await supabase
    .from("guardian_links")
    .select("student_id")
    .eq("guardian_id", userId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .single();
  if (!link) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "No active guardian link." } },
      { status: 403 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", studentId)
    .single();
  const displayName = (profile as { display_name: string } | null)?.display_name ?? studentId.slice(0, 8);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id,course_id,courses(title),status")
    .eq("student_id", studentId);
  const enr =
    (enrollments as
      { id: string; course_id: string; courses: { title: string } | null; status: string }[] | null) ?? [];
  const enrIds = enr.map((e) => e.id);

  // Progress snapshot terbaru per enrollment.
  const { data: snaps } =
    enrIds.length > 0
      ? await supabase
          .from("progress_snapshots")
          .select("enrollment_id,percent,mastery,recorded_at")
          .in("enrollment_id", enrIds)
          .order("recorded_at", { ascending: false })
      : { data: [] as { enrollment_id: string; percent: number; mastery: number; recorded_at: string }[] };
  const snapRows =
    (snaps as { enrollment_id: string; percent: number; mastery: number; recorded_at: string }[] | null) ??
    [];
  const latestSnap = new Map<string, (typeof snapRows)[number]>();
  for (const s of snapRows) {
    if (!latestSnap.has(s.enrollment_id)) latestSnap.set(s.enrollment_id, s);
  }

  // Certificates.
  const { data: certs } =
    enrIds.length > 0
      ? await supabase
          .from("certificates")
          .select("serial_no,status,issued_at,level_id,enrollment_id")
          .in("enrollment_id", enrIds)
          .order("issued_at", { ascending: false })
      : {
          data: [] as {
            serial_no: string;
            status: string;
            issued_at: string;
            level_id: string;
            enrollment_id: string;
          }[],
        };
  const certRows =
    (certs as
      | { serial_no: string; status: string; issued_at: string; level_id: string; enrollment_id: string }[]
      | null) ?? [];

  const enrTitle = new Map(enr.map((e) => [e.id, e.courses?.title ?? "Course"]));

  const headers = ["Course", "Enrollment Status", "Progress %", "Mastery %", "Last Snapshot"];
  const rows = enr.map((e) => {
    const s = latestSnap.get(e.id);
    return [
      e.courses?.title ?? "Course",
      e.status,
      s ? String(s.percent) : "",
      s ? String(Math.round(s.mastery * 100)) : "",
      s?.recorded_at ?? "",
    ];
  });

  const certHeaders = ["Course", "Serial", "Status", "Issued At"];
  const certRowsOut = certRows.map((c) => [
    enrTitle.get(c.enrollment_id ?? "") ?? "",
    c.serial_no,
    c.status,
    c.issued_at,
  ]);

  const csv =
    `CHILD PROGRESS SUMMARY\nStudent: ${displayName}\nStudent ID: ${studentId}\n\nProgress by Course\n` +
    toCsv(headers, rows) +
    "\nCertificates\n" +
    toCsv(certHeaders, certRowsOut);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="child-summary-${studentId.slice(0, 8)}.csv"`,
    },
  });
}
