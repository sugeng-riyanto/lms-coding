"use client";

import { useEffect, useState } from "react";
import { activityCacheKey, cacheGet } from "@/lib/offline-cache";
import { OfflineBanner } from "@/components/offline-banner";
import { ActivityView } from "@/app/(student)/activities/[activityId]/activity-view";
import { mkT, type Lang } from "@/lib/i18n";
import { ACTIVITY } from "@/lib/ui-text/activity";
import type { ActivityData } from "@/app/(student)/activities/[activityId]/page";

/**
 * AC-2: saat fetch activity gagal (offline / DB mati), render dari cache
 * IndexedDB bila pernah dibuka sebelumnya; bila belum, tampilkan pesan jelas.
 * Banner offline selalu tampil agar murid tahu ini salinan tersimpan.
 */
export function OfflineActivityFallback({
  activityId,
  enrollmentId,
  lang,
}: {
  activityId: string;
  enrollmentId: string;
  lang: Lang;
}) {
  const t = mkT(ACTIVITY, lang);
  const [state, setState] = useState<"loading" | "hit" | "miss">("loading");
  const [cached, setCached] = useState<ActivityData | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    cacheGet<ActivityData>(activityCacheKey(activityId)).then((hit) => {
      if (!alive) return;
      if (hit) {
        setCached(hit.value);
        setCachedAt(hit.cachedAt);
        setState("hit");
      } else {
        setState("miss");
      }
    });
    return () => {
      alive = false;
    };
  }, [activityId]);

  if (state === "loading") {
    return (
      <div className="mt-2">
        <p className="text-sm text-slate-500">{t("loading")}</p>
      </div>
    );
  }

  if (state === "miss") {
    return (
      <div className="mt-2">
        <OfflineBanner />
        <div
          role="alert"
          className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
        >
          <p className="font-semibold">{t("offlineUnavailableTitle")}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("offlineUnavailableBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <OfflineBanner fromCacheAt={cachedAt} />
      {cached && <ActivityView activity={cached} enrollmentId={enrollmentId} lang={lang} />}
    </div>
  );
}
