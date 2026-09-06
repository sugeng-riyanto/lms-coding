"use client";

import { useEffect } from "react";
import { activityCacheKey, cachePut } from "@/lib/offline-cache";

/**
 * AC-1: setelah activity berhasil dimuat dari server (sudah lolos RLS),
 * simpan snapshot-nya ke cache IndexedDB agar bisa dibaca saat offline.
 * Fail-soft — bila cache tidak tersedia, tidak ada efek samping.
 */
export function ActivityCacheSeed({ activity }: { activity: { id: string } }) {
  useEffect(() => {
    void cachePut(activityCacheKey(activity.id), activity);
  }, [activity]);
  return null;
}
