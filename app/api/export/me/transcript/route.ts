import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { checkRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/me/transcript — CSV transkrip belajar murid sendiri.
 * Hanya data milik auth.uid(): attempts (status + final_score), level
 * certificate aktif, dan progress snapshot terbaru per enrollment.
 * Tidak ada data murid lain (RLS + filter eksplisit). Sel anti
 * formula-injection via lib/csv.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Not signed in." } },
      { status: 401 },
    );
  }
  if (!checkRateLimit(`transcript:${userId}`, 5, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests." } },
      { status: 429 },
    );
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id,course_id,courses(title),cohort_id,status")
    .eq("student_id", userId);
  const enr =
    (enrollments as
      | {
          id: string;
          course_id: string;
          courses: { title: string } | null;
          cohort_id: string | null;
          status: string;
        }[]
      | null) ?? [];
  const enrIds = enr.map((e) => e.id);

  // Attempts (hanya milikku via enrollment chain; RLS sudah membatasi).
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id,assessment_id,attempt_no,status,final_score,submitted_at,enrollment_id")
    .in("enrollment_id", enrIds)
    .order("submitted_at", { ascending: false });
  const atts =
    (attempts as
      | {
          id: string;
          assessment_id: string;
          attempt_no: number;
          status: string;
          final_score: number | null;
          submitted_at: string | null;
          enrollment_id: string;
        }[]
      | null) ?? [];

  // Assessment titles untuk kolom "Assessment".
  const asmtIds = [...new Set(atts.map((a) => a.assessment_id))];
  const { data: asmts } =
    asmtIds.length > 0
      ? await supabase.from("assessments").select("id,activity_id,activities(title)").in("id", asmtIds)
      : { data: [] as { id: string; activity_id: string; activities: { title: string } | null }[] };
  const titleById = new Map(
    ((asmts as { id: string; activity_id: string; activities: { title: string } | null }[] | null) ?? []).map(
      (a) => [a.id, a.activities?.title ?? "Assessment"],
    ),
  );

  // Certificates (aktif/revoked).
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

  const enrTitle = new Map(enr.map((e) => [e.id, e.courses?.title ?? "Course"]));

  // Bagian 1: Attempts.
  const attemptHeaders = ["Course", "Assessment", "Attempt", "Status", "Final Score", "Submitted At"];
  const attemptRows = atts.map((a) => [
    enrTitle.get(a.enrollment_id ?? "") ?? "",
    titleById.get(a.assessment_id) ?? "",
    String(a.attempt_no),
    a.status,
    a.final_score === null ? "" : String(a.final_score),
    a.submitted_at ?? "",
  ]);

  // Bagian 2: Progress ringkas per enrollment.
  const progressHeaders = ["Course", "Status", "Progress %", "Mastery %", "Last Snapshot"];
  const progressRows = enr.map((e) => {
    const s = latestSnap.get(e.id);
    return [
      e.courses?.title ?? "Course",
      e.status,
      s ? String(s.percent) : "",
      s ? String(Math.round(s.mastery * 100)) : "",
      s?.recorded_at ?? "",
    ];
  });

  // Bagian 3: Certificates.
  const certHeaders = ["Course", "Serial", "Status", "Issued At"];
  const certRowsOut = certRows.map((c) => [
    enrTitle.get(c.enrollment_id ?? "") ?? "",
    c.serial_no,
    c.status,
    c.issued_at,
  ]);

  const csv =
    "MY LEARNING TRANSCRIPT\n" +
    "\n" +
    "Attempts\n" +
    toCsv(attemptHeaders, attemptRows) +
    "\nProgress by Course\n" +
    toCsv(progressHeaders, progressRows) +
    "\nCertificates\n" +
    toCsv(certHeaders, certRowsOut);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-transcript.csv"',
    },
  });
}
