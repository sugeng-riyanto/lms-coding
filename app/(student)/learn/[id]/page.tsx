"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { recordLearningEvent } from "@/features/actions";
import { enqueueEvent, flushQueue, makeClientEventId, pendingCount } from "@/lib/sync-queue";

const DRAFT_KEY = "lms-lesson-draft";

export default function LessonPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get("enrollment") ?? "";
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(`${DRAFT_KEY}-${params.id}`) ?? "";
  });
  const [savedAt, setSavedAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`${DRAFT_KEY}-${params.id}`) ? "Dipulihkan dari perangkat ini" : null;
  });
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const sync = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine && enrollmentId) {
        void flushQueue(enrollmentId, (e) => recordLearningEvent(e)).then((r) => setPending(r.remaining));
      } else if (enrollmentId) {
        setPending(pendingCount(enrollmentId));
      }
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [enrollmentId]);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(`${DRAFT_KEY}-${params.id}`, draft);
      if (draft) setSavedAt(`Tersimpan otomatis ${new Date().toLocaleTimeString("id-ID")}`);
      // Antrekan sync server (idempotent via client_event_id); flush saat online.
      if (draft && enrollmentId) {
        enqueueEvent(enrollmentId, {
          enrollmentId,
          eventType: "draft_saved",
          entityType: "lesson",
          entityId: params.id,
          clientEventId: makeClientEventId(),
          metadata: { length: draft.length },
        });
        if (navigator.onLine) {
          void flushQueue(enrollmentId, (e) => recordLearningEvent(e)).then((r) => setPending(r.remaining));
        } else {
          setPending(pendingCount(enrollmentId));
        }
      }
    }, 800);
    return () => clearTimeout(t);
  }, [draft, params.id, enrollmentId]);

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-slate-500">Lesson player — {params.id}</p>
      <h1 className="text-3xl font-bold">Tujuan → Materi → Contoh → Latihan → Refleksi</h1>
      {offline && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-amber-900">
          Offline — jawaban tersimpan di perangkat dan akan dikirim ulang otomatis.
        </p>
      )}
      {pending > 0 && (
        <p role="status" className="mt-2 rounded-lg bg-slate-100 p-3 text-sm">
          {pending} event menunggu sinkronisasi.
        </p>
      )}
      <label htmlFor="reflection" className="mt-6 block font-semibold">
        Refleksi: apa yang kamu pahami dan apa buktinya?
      </label>
      <textarea
        id="reflection"
        rows={6}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="mt-2 w-full rounded-lg border px-3 py-2"
        placeholder="Tulis refleksimu…"
      />
      <p role="status" className="mt-2 text-sm text-slate-600">
        {savedAt ?? "Belum ada draft."}
      </p>
    </main>
  );
}
