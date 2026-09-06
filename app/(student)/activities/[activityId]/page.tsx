import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActivityView } from "./activity-view";

export const dynamic = "force-dynamic";

export interface ActivityData {
  id: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  assessmentId: string | null;
}

/** Renderer activity Tahap A: web membuka Roblox (tanpa klaim iframe), completion manual. */
async function getActivity(activityId: string): Promise<ActivityData | null> {
  const supabase = await createClient();
  const { data: act } = await supabase
    .from("activities")
    .select("id,type,title,content_json")
    .eq("id", activityId)
    .single();
  const a = act as { id: string; type: string; title: string; content_json: Record<string, unknown> } | null;
  if (!a) return null;
  let assessmentId: string | null = null;
  if (a.type === "quiz") {
    const { data: asmt } = await supabase
      .from("assessments")
      .select("id")
      .eq("activity_id", a.id)
      .limit(1)
      .single();
    assessmentId = (asmt as { id: string } | null)?.id ?? null;
  }
  return { id: a.id, type: a.type, title: a.title, content: a.content_json ?? {}, assessmentId };
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ enrollment?: string }>;
}) {
  const { activityId } = await params;
  const { enrollment } = await searchParams;
  let data: ActivityData | null;
  try {
    data = await getActivity(activityId);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert">Activity tidak dapat dimuat.</p>
      </main>
    );
  }
  if (!data) notFound();
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-slate-500">{data.type}</p>
      <h1 className="text-3xl font-bold">{data.title}</h1>
      <ActivityView activity={data} enrollmentId={enrollment ?? ""} />
    </main>
  );
}
