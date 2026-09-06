/**
 * Offline retry queue (Prompt 04): antrekan learning events di localStorage,
 * flush idempotent via recordLearningEvent (unik student_id+client_event_id).
 */

export interface QueuedEvent {
  enrollmentId: string;
  eventType: "lesson_opened" | "activity_completed" | "draft_saved" | "heartbeat";
  entityType: "lesson" | "activity";
  entityId: string;
  clientEventId: string;
  metadata: Record<string, unknown>;
}

const PREFIX = "lms-event-queue";

function key(studentKey: string): string {
  return `${PREFIX}-${studentKey}`;
}

export function enqueueEvent(studentKey: string, event: QueuedEvent): void {
  const raw = localStorage.getItem(key(studentKey));
  const queue: QueuedEvent[] = raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
  if (queue.some((q) => q.clientEventId === event.clientEventId)) return; // tanpa duplikasi
  queue.push(event);
  localStorage.setItem(key(studentKey), JSON.stringify(queue));
}

export function pendingCount(studentKey: string): number {
  const raw = localStorage.getItem(key(studentKey));
  return raw ? (JSON.parse(raw) as QueuedEvent[]).length : 0;
}

export function makeClientEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `evt-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/**
 * Flush antrekan: sender disuntik agar testable (production: recordLearningEvent).
 * Berhasil per-event dihapus; gagal dipertahankan untuk retry.
 */
export async function flushQueue(
  studentKey: string,
  sender: (event: QueuedEvent) => Promise<{ ok: boolean }>,
): Promise<{ sent: number; remaining: number }> {
  const raw = localStorage.getItem(key(studentKey));
  const queue: QueuedEvent[] = raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
  const remaining: QueuedEvent[] = [];
  let sent = 0;
  for (const event of queue) {
    try {
      const res = await sender(event);
      if (res.ok) sent += 1;
      else remaining.push(event);
    } catch {
      remaining.push(event);
    }
  }
  localStorage.setItem(key(studentKey), JSON.stringify(remaining));
  return { sent, remaining: remaining.length };
}
