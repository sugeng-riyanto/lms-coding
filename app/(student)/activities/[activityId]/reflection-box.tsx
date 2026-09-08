"use client";

import { useEffect, useRef, useState } from "react";
import { recordLearningEvent } from "@/features/actions";
import { enqueueEvent, makeClientEventId, type QueuedEvent } from "@/lib/sync-queue";
import { MAX_DRAFT_CHARS } from "@/lib/active-time";
import { mkT, type Lang } from "@/lib/i18n";
import { ACTIVITY } from "@/lib/ui-text/activity";

type DraftStatus = "idle" | "saving" | "saved" | "offline" | "error";

function draftKey(activityId: string): string {
  return `lms-draft-${activityId}`;
}

function readDraft(activityId: string): string {
  try {
    return (localStorage.getItem(draftKey(activityId)) ?? "").slice(0, MAX_DRAFT_CHARS);
  } catch {
    return "";
  }
}

/**
 * Autosave draft refleksi: teks langsung disimpan ke localStorage (recovery
 * saat refresh/koneksi hilang), lalu event draft_saved dikirim/antrekan
 * (hanya panjang teks — minimisasi data). Indikator: saving → saved, offline
 * bila tanpa jaringan, error bila server menolak (draf tetap aman lokal).
 */
export function ReflectionBox({
  activityId,
  enrollmentId,
  lang,
}: {
  activityId: string;
  enrollmentId: string;
  lang: Lang;
}) {
  const t = mkT(ACTIVITY, lang);
  const STATUS_TEXT: Record<DraftStatus, string> = {
    idle: "",
    saving: t("draftSaving"),
    saved: t("draftSaved"),
    offline: t("draftOffline"),
    error: t("draftError"),
  };
  // Refresh recovery: draf dipulihkan dari localStorage via lazy initializer
  // (tanpa setState-in-effect; activityId stabil per mount).
  const [value, setValue] = useState<string>(() => readDraft(activityId));
  const [status, setStatus] = useState<DraftStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function autosave(next: string) {
    try {
      localStorage.setItem(draftKey(activityId), next.slice(0, MAX_DRAFT_CHARS));
    } catch {
      /* abaikan */
    }
    if (!navigator.onLine) {
      enqueueDraft(next);
      setStatus("offline");
      return;
    }
    setStatus("saving");
    void (async () => {
      const res = await recordLearningEvent({
        enrollmentId,
        eventType: "draft_saved",
        entityType: "activity",
        entityId: activityId,
        clientEventId: makeClientEventId(),
        metadata: { chars: next.length },
      });
      if (res.ok) {
        setStatus("saved");
      } else {
        enqueueDraft(next);
        setStatus("error");
      }
    })();
  }

  function enqueueDraft(next: string) {
    const event: QueuedEvent = {
      enrollmentId,
      eventType: "draft_saved",
      entityType: "activity",
      entityId: activityId,
      clientEventId: makeClientEventId(),
      metadata: { chars: next.length },
    };
    enqueueEvent(enrollmentId, event);
  }

  function onChange(next: string) {
    const clipped = next.slice(0, MAX_DRAFT_CHARS);
    setValue(clipped);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => autosave(clipped), 800);
  }

  return (
    <div className="mt-4">
      <label htmlFor={`reflection-${activityId}`} className="block text-sm font-medium text-slate-700">
        {t("reflectionLabel")}
      </label>
      <textarea
        id={`reflection-${activityId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_DRAFT_CHARS}
        rows={5}
        placeholder={t("reflectionPlaceholder")}
        className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
      />
      <p aria-live="polite" className="mt-1 text-xs text-slate-500">
        {STATUS_TEXT[status]}
      </p>
    </div>
  );
}
