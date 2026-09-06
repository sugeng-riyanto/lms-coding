import { createClient } from "@/lib/supabase/server";
import { orderedReviewQueue, startOfNextDayInTz } from "@/lib/progress-planning";
import { ReviewForm, type DueItem } from "./review-form";

export const dynamic = "force-dynamic";

/** Antrian spaced review (retrieval practice 1/3/7/14): item jatuh tempo hari
 *  ini/terlambat, diurutkan overdue → hari ini → terdekat (lib murni). */
async function getDueItems(userId: string): Promise<{
  enrollmentId: string;
  courseTitle: string;
  items: DueItem[];
} | null> {
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id,course_id,courses(title)")
    .eq("student_id", userId)
    .eq("status", "active")
    .limit(1);
  const enr = ((enrollments as
    { id: string; course_id: string; courses: { title: string } | null }[] | null) ?? [])[0];
  if (!enr?.courses) return null;

  const dueLimit = startOfNextDayInTz(new Date());
  const { data: itemRows } = await supabase
    .from("review_items")
    .select("id,entity_type,entity_id,due_at,interval_idx")
    .eq("enrollment_id", enr.id)
    .eq("status", "scheduled")
    .lte("due_at", dueLimit.toISOString());
  const rows =
    (itemRows as
      | { id: string; entity_type: string; entity_id: string; due_at: string; interval_idx: number }[]
      | null) ?? [];
  if (rows.length === 0) return { enrollmentId: enr.id, courseTitle: enr.courses.title, items: [] };

  const levelIds = [...new Set(rows.filter((r) => r.entity_type === "level").map((r) => r.entity_id))];
  const titleById = new Map<string, string>();
  if (levelIds.length > 0) {
    const { data: levelRows } = await supabase.from("levels").select("id,title").in("id", levelIds);
    for (const l of (levelRows as { id: string; title: string }[] | null) ?? []) titleById.set(l.id, l.title);
  }
  const { data: snapRows } = await supabase
    .from("progress_snapshots")
    .select("entity_id,mastery")
    .eq("enrollment_id", enr.id)
    .eq("entity_type", "level")
    .in("entity_id", levelIds);
  const masteryById = new Map(
    ((snapRows as { entity_id: string; mastery: number }[] | null) ?? []).map((s) => [
      s.entity_id,
      s.mastery,
    ]),
  );

  const candidates = rows.map((r) => ({
    id: r.id,
    title: titleById.get(r.entity_id) ?? r.entity_id.slice(0, 8),
    dueAt: new Date(r.due_at),
    mastery: masteryById.get(r.entity_id) ?? 0,
  }));
  const ordered = orderedReviewQueue(candidates, { now: new Date() });
  return {
    enrollmentId: enr.id,
    courseTitle: enr.courses.title,
    items: ordered.map((c) => ({
      id: c.id,
      title: c.title,
      dueAt: c.dueAt.toISOString(),
      intervalIdx: rows.find((r) => r.id === c.id)?.interval_idx ?? 1,
    })),
  };
}

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  let data: Awaited<ReturnType<typeof getDueItems>> = null;
  if (userId) {
    try {
      data = await getDueItems(userId);
    } catch {
      data = null;
    }
  }

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold text-blue-700">Ulasan terjadwal</p>
      <h1 className="mt-1 text-3xl font-bold">Spaced review</h1>
      {!data ? (
        <p className="mt-4 rounded-xl border p-5" role="status">
          Belum ada enrollment aktif. Hubungi guru Anda untuk didaftarkan ke kelas.
        </p>
      ) : data.items.length === 0 ? (
        <p className="mt-4 rounded-xl border p-5" role="status">
          Tidak ada review yang jatuh tempo. Kembali lagi sesuai jadwal — retrieval practice memperkuat
          ingatan jangka panjang. 🧠
        </p>
      ) : (
        <ReviewForm enrollmentId={data.enrollmentId} courseTitle={data.courseTitle} items={data.items} />
      )}
    </main>
  );
}
