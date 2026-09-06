/**
 * Insight guru Phase 5 (ANALYTICS.md) — logika MURNI (tanpa I/O):
 * learning-path bottleneck + teacher weekly action digest.
 *
 * Aturan yang sama dengan analytics lain: definisi berversi, hasil
 * deterministik & dapat direkonsiliasi, cohort kecil ditandai (n + guard),
 * sinyal explainable (setiap item membawa alasan), tanpa ranking publik.
 */

export const TEACHER_ANALYTICS_DEFINITIONS_VERSION = "2026-09-06/v1";

/** Ukuran minimal murid yang "mulai" sebuah lesson agar bottleneck layak diklaim. */
export const BOTTLENECK_MIN_N = 3;

export interface BottleneckLesson {
  id: string;
  title: string;
}

export interface BottleneckEvent {
  lessonId: string;
  enrollmentId: string;
}

export interface BottleneckRow {
  lessonId: string;
  title: string;
  /** Jumlah murid (enrollment unik) yang MEMBUKA lesson (lesson_opened). */
  opened: number;
  /** Jumlah murid yang menyelesaikan lesson (snapshot status completed). */
  completed: number;
  /** 1 − completed/opened (0..1); null bila opened = 0. */
  dropoff: number | null;
  severity: "high" | "watch" | "ok" | "insufficient";
}

/**
 * Bottleneck: lesson tempat banyak murid berhenti (dibuka tapi tidak
 * selesai). dropoff = 1 − selesai/mulai; urut dropoff turun lalu opened
 * turun lalu judul naik (deterministik). opened < minN → "insufficient"
 * (cohort kecil, jangan klaim).
 */
export function bottleneckAnalysis(
  lessons: BottleneckLesson[],
  opened: BottleneckEvent[],
  completed: BottleneckEvent[],
  opts: { minN?: number } = {},
): BottleneckRow[] {
  const minN = opts.minN ?? BOTTLENECK_MIN_N;
  const openedByLesson = new Map<string, Set<string>>();
  for (const e of opened) {
    const s = openedByLesson.get(e.lessonId) ?? new Set<string>();
    s.add(e.enrollmentId);
    openedByLesson.set(e.lessonId, s);
  }
  const completedByLesson = new Map<string, Set<string>>();
  for (const e of completed) {
    const s = completedByLesson.get(e.lessonId) ?? new Set<string>();
    s.add(e.enrollmentId);
    completedByLesson.set(e.lessonId, s);
  }

  const rows: BottleneckRow[] = lessons.map((l) => {
    const nOpened = openedByLesson.get(l.id)?.size ?? 0;
    const nCompleted = completedByLesson.get(l.id)?.size ?? 0;
    const dropoff = nOpened === 0 ? null : Math.max(0, 1 - nCompleted / nOpened);
    let severity: BottleneckRow["severity"] = "ok";
    if (nOpened < minN) severity = "insufficient";
    else if (dropoff !== null && dropoff >= 0.4) severity = "high";
    else if (dropoff !== null && dropoff >= 0.2) severity = "watch";
    return { lessonId: l.id, title: l.title, opened: nOpened, completed: nCompleted, dropoff, severity };
  });
  rows.sort(
    (a, b) => (b.dropoff ?? -1) - (a.dropoff ?? -1) || b.opened - a.opened || a.title.localeCompare(b.title),
  );
  return rows;
}

export interface DigestAlert {
  id: string;
  message: string;
  createdAt: string;
  status: string;
}

export interface DigestInactiveStudent {
  studentId: string;
  displayName: string;
  lastActivityAt: string | null;
}

export interface TeacherDigestInput {
  pendingGrading: number;
  openAlerts: DigestAlert[];
  inactiveStudents: DigestInactiveStudent[];
  now?: Date;
}

export interface DigestAction {
  id: string;
  title: string;
  detail: string;
  reason: string;
  /** 1 = paling penting. */
  priority: 1 | 2 | 3;
  href: string;
}

/**
 * Tiga prioritas tindakan guru minggu ini (bukan grafik): nilai manual,
 * peringatan belum ditindaklanjuti, murid tidak aktif. Setiap item membawa
 * alasan; kosong → item tunggal "tidak ada tindakan mendesak". Deterministik.
 */
export function buildTeacherDigest(input: TeacherDigestInput): DigestAction[] {
  const now = input.now ?? new Date();
  const actions: DigestAction[] = [];

  if (input.pendingGrading > 0) {
    actions.push({
      id: "digest-pending-grading",
      title: `Nilai ${input.pendingGrading} jawaban manual`,
      detail: `${input.pendingGrading} attempt menunggu penilaian di antrian grading.`,
      reason: `Antrian penilaian menumpuk ${input.pendingGrading} item — murid menunggu umpan balik.`,
      priority: 1,
      href: "/teacher/grading",
    });
  }

  const unresolved = input.openAlerts.filter((a) => a.status !== "resolved");
  if (unresolved.length > 0) {
    const oldest = [...unresolved].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    actions.push({
      id: "digest-alerts",
      title: `Tindak lanjuti ${unresolved.length} peringatan murid`,
      detail: oldest ? `Tertua: ${oldest.message}` : "",
      reason: `${unresolved.length} peringatan belum selesai — sinyal risiko yang dapat ditindaklanjuti.`,
      priority: unresolved.length >= 5 ? 1 : 2,
      href: "/teacher",
    });
  }

  if (input.inactiveStudents.length > 0) {
    const names = input.inactiveStudents
      .slice(0, 3)
      .map((s) => s.displayName || "murid")
      .join(", ");
    actions.push({
      id: "digest-inactive",
      title: `Hubungi ${input.inactiveStudents.length} murid tidak aktif`,
      detail: names + (input.inactiveStudents.length > 3 ? ", …" : ""),
      reason: `Tanpa aktivitas belajar ${">"} 7 hari — risiko tertinggal.`,
      priority: 3,
      href: "/teacher/analytics",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "digest-clear",
      title: "Tidak ada tindakan mendesak",
      detail: "Antrian nilai kosong, tidak ada peringatan terbuka, semua murid aktif.",
      reason: "Dipantau pada " + now.toISOString(),
      priority: 3,
      href: "/teacher",
    });
  }

  return actions.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).slice(0, 3);
}
