import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Detail murid: timeline, attempts, revisions, certificates (RLS cohort guru). */
async function getDetail(studentId: string, cohortId: string | undefined) {
  const supabase = await createClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("display_name,status")
    .eq("id", studentId)
    .single();
  const profile = prof as { display_name: string; status: string } | null;
  if (!profile) return null;

  let q = supabase.from("enrollments").select("id,course_id,courses(title)").eq("student_id", studentId);
  if (cohortId) q = q.eq("cohort_id", cohortId);
  const { data: enrollments } = await q;
  const enrs =
    (enrollments as { id: string; course_id: string; courses: { title: string } | null }[] | null) ?? [];

  const attempts: { id: string; no: number; status: string; score: number | null; at: string }[] = [];
  const events: { type: string; at: string }[] = [];
  const revisions: { attempt: string; prev: number | null; next: number | null; reason: string }[] = [];
  for (const e of enrs) {
    const { data: atts } = await supabase
      .from("attempts")
      .select("id,attempt_no,status,final_score,submitted_at")
      .eq("enrollment_id", e.id)
      .order("submitted_at", { ascending: false })
      .limit(20);
    for (const a of (atts as
      | {
          id: string;
          attempt_no: number;
          status: string;
          final_score: number | null;
          submitted_at: string | null;
        }[]
      | null) ?? []) {
      attempts.push({
        id: a.id,
        no: a.attempt_no,
        status: a.status,
        score: a.final_score,
        at: a.submitted_at ?? "—",
      });
      const { data: revs } = await supabase
        .from("grade_revisions")
        .select("previous_score,new_score,reason")
        .eq("attempt_id", a.id);
      for (const r of (revs as
        { previous_score: number | null; new_score: number | null; reason: string }[] | null) ?? []) {
        revisions.push({
          attempt: a.id.slice(0, 8),
          prev: r.previous_score,
          next: r.new_score,
          reason: r.reason,
        });
      }
    }
    const { data: evs } = await supabase
      .from("learning_events")
      .select("event_type,occurred_at")
      .eq("enrollment_id", e.id)
      .order("occurred_at", { ascending: false })
      .limit(20);
    for (const ev of (evs as { event_type: string; occurred_at: string }[] | null) ?? []) {
      events.push({ type: ev.event_type, at: ev.occurred_at });
    }
  }
  const { data: certs } = await supabase
    .from("certificates")
    .select("serial_no,status,issued_at")
    .in(
      "enrollment_id",
      enrs.map((e) => e.id),
    );
  return {
    profile,
    courses: enrs.map((e) => e.courses?.title ?? e.course_id),
    attempts,
    events,
    revisions,
    certs: (certs as { serial_no: string; status: string; issued_at: string }[] | null) ?? [],
  };
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { studentId } = await params;
  const { cohort } = await searchParams;
  let data: Awaited<ReturnType<typeof getDetail>>;
  try {
    data = await getDetail(studentId, cohort);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <p role="alert">Detail murid tidak dapat dimuat.</p>
      </main>
    );
  }
  if (!data) notFound();

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/teacher" className="text-sm text-blue-700 underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{data.profile.display_name}</h1>
      <p className="text-sm text-slate-500">
        Status: {data.profile.status} · {data.courses.join(", ")}
      </p>

      <h2 className="mt-6 text-xl font-semibold">Attempt history</h2>
      {data.attempts.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Belum ada attempt.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {data.attempts.map((a) => (
            <li key={a.id} className="rounded border px-3 py-2">
              #{a.no} · {a.status} · skor {a.score ?? "—"} · {a.at}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-xl font-semibold">Revisi nilai (audit)</h2>
      {data.revisions.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Tidak ada revisi.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {data.revisions.map((r, i) => (
            <li key={i} className="rounded border px-3 py-2">
              {r.attempt}: {r.prev ?? "—"} → {r.next ?? "—"} · {r.reason}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-xl font-semibold">Timeline belajar</h2>
      {data.events.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Belum ada event.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {data.events.map((e, i) => (
            <li key={i} className="rounded border px-3 py-2">
              {e.type} · {e.at}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-xl font-semibold">Sertifikat</h2>
      {data.certs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Belum ada sertifikat.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {data.certs.map((c) => (
            <li key={c.serial_no} className="rounded border px-3 py-2">
              {c.serial_no} · {c.status} · {c.issued_at}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
