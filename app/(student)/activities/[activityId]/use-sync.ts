"use client";

import { useEffect, useRef } from "react";
import { recordLearningEvent } from "@/features/actions";
import { enqueueEvent, flushQueue, makeClientEventId, type QueuedEvent } from "@/lib/sync-queue";
import { clampActiveMs, nextHeartbeatAllowed } from "@/lib/active-time";

const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_TIMEOUT_MS = 60_000;

/**
 * Heartbeat belajar yang jujur: hanya saat tab visible DAN ada aktivitas
 * pointer/keyboard dalam jendela (idle → tidak menghitung waktu), durasi
 * per-event di-clamp client-side, jarak antar heartbeat dibatasi. Gagal →
 * masuk retry queue (tanpa duplikasi via client_event_id).
 */
export function useEngagementHeartbeat(opts: {
  enrollmentId: string;
  entityType: "lesson" | "activity";
  entityId: string;
  studentKey: string;
  enabled: boolean;
}) {
  const lastSent = useRef<number | null>(null);
  const lastActivity = useRef<number>(0);
  const { enrollmentId, entityType, entityId, studentKey, enabled } = opts;

  useEffect(() => {
    if (!enabled || !enrollmentId) return;
    lastActivity.current = Date.now(); // awal sesi = aktif (ref write, bukan render)
    const bump = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener("pointermove", bump);
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);

    const send = async () => {
      if (document.visibilityState !== "visible") return; // tab tersembunyi
      if (Date.now() - lastActivity.current > IDLE_TIMEOUT_MS) return; // idle
      if (!nextHeartbeatAllowed(lastSent.current, Date.now())) return;
      lastSent.current = Date.now();
      const event: QueuedEvent = {
        enrollmentId,
        eventType: "heartbeat",
        entityType,
        entityId,
        clientEventId: makeClientEventId(),
        metadata: { activeMs: clampActiveMs(HEARTBEAT_INTERVAL_MS) },
      };
      try {
        const res = await recordLearningEvent(event);
        if (!res.ok) enqueueEvent(studentKey, event);
      } catch {
        enqueueEvent(studentKey, event);
      }
    };

    const interval = setInterval(send, HEARTBEAT_INTERVAL_MS);
    return () => {
      window.removeEventListener("pointermove", bump);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      clearInterval(interval);
    };
  }, [enabled, enrollmentId, entityType, entityId, studentKey]);
}

/**
 * Reconnect: saat browser kembali online, flush retry queue (event offline
 * dikirim ulang; yang sukses dihapus, yang gagal dipertahankan).
 */
export function useOfflineFlush(opts: { studentKey: string; enabled: boolean }) {
  const { studentKey, enabled } = opts;
  useEffect(() => {
    if (!enabled) return;
    const flush = async () => {
      await flushQueue(studentKey, async (event) => {
        try {
          const res = await recordLearningEvent(event);
          return { ok: res.ok };
        } catch {
          return { ok: false };
        }
      });
    };
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [studentKey, enabled]);
}
