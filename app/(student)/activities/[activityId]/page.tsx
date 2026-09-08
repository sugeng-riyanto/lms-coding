import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/i18n";
import { ActivityView } from "./activity-view";
import { OfflineBanner } from "@/components/offline-banner";
import { ActivityCacheSeed } from "@/components/activity-cache-seed";
import { OfflineActivityFallback } from "@/components/offline-activity-fallback";

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
  const lang = await getLang();
  let data: ActivityData | null;
  try {
    data = await getActivity(activityId);
  } catch {
    // Offline / DB tidak terjangkau → fallback dari cache IndexedDB (slice 1).
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <OfflineActivityFallback activityId={activityId} enrollmentId={enrollment ?? ""} lang={lang} />
      </main>
    );
  }
  if (!data) notFound();
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <OfflineBanner />
      <ActivityCacheSeed activity={data} />
      <p className="text-sm text-slate-500">{data.type}</p>
      <h1 className="text-3xl font-bold">{data.title}</h1>
      <ActivityView activity={data} enrollmentId={enrollment ?? ""} lang={lang} />
    </main>
  );
}
