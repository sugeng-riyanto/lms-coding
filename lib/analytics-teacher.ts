/**
 * Insight guru Phase 5 (ANALYTICS.md) — logika MURNI (tanpa I/O):
 * learning-path bottleneck + teacher weekly action digest.
 *
 * Aturan yang sama dengan analytics lain: definisi berversi, hasil
 * deterministik & dapat direkonsiliasi, cohort kecil ditandai (n + guard),
 * sinyal explainable (setiap item membawa alasan), tanpa ranking publik.
 */

export const TEACHER_ANALYTICS_DEFINITIONS_VERSION = "2026-09-06/v1";

export const CLASS_DISTRIBUTION_DEFINITIONS_VERSION = "2026-09-07/v1";

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
 * `lang` memilih bahasa judul/alasan (default Indonesia, sesuai DEFAULT_LANG).
 */
export function buildTeacherDigest(input: TeacherDigestInput, lang: "id" | "en" = "id"): DigestAction[] {
  const now = input.now ?? new Date();
  const actions: DigestAction[] = [];
  const en = lang === "en";

  if (input.pendingGrading > 0) {
    actions.push({
      id: "digest-pending-grading",
      title: en
        ? `Grade ${input.pendingGrading} manual ${input.pendingGrading === 1 ? "answer" : "answers"}`
        : `Nilai ${input.pendingGrading} jawaban manual`,
      detail: en
        ? `${input.pendingGrading} ${input.pendingGrading === 1 ? "attempt is" : "attempts are"} waiting in the grading queue.`
        : `${input.pendingGrading} attempt menunggu penilaian di antrian grading.`,
      reason: en
        ? `The grading queue has ${input.pendingGrading} ${input.pendingGrading === 1 ? "item" : "items"} backed up — students are waiting for feedback.`
        : `Antrian penilaian menumpuk ${input.pendingGrading} item — murid menunggu umpan balik.`,
      priority: 1,
      href: "/teacher/grading",
    });
  }

  const unresolved = input.openAlerts.filter((a) => a.status !== "resolved");
  if (unresolved.length > 0) {
    const oldest = [...unresolved].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    actions.push({
      id: "digest-alerts",
      title: en
        ? `Follow up on ${unresolved.length} student ${unresolved.length === 1 ? "alert" : "alerts"}`
        : `Tindak lanjuti ${unresolved.length} peringatan murid`,
      detail: oldest ? `${en ? "Oldest: " : "Tertua: "}${oldest.message}` : "",
      reason: en
        ? `${unresolved.length} ${unresolved.length === 1 ? "alert is" : "alerts are"} unresolved — actionable risk signals.`
        : `${unresolved.length} peringatan belum selesai — sinyal risiko yang dapat ditindaklanjuti.`,
      priority: unresolved.length >= 5 ? 1 : 2,
      href: "/teacher",
    });
  }

  if (input.inactiveStudents.length > 0) {
    const names = input.inactiveStudents
      .slice(0, 3)
      .map((s) => s.displayName || (en ? "student" : "murid"))
      .join(", ");
    actions.push({
      id: "digest-inactive",
      title: en
        ? `Reach out to ${input.inactiveStudents.length} inactive ${input.inactiveStudents.length === 1 ? "student" : "students"}`
        : `Hubungi ${input.inactiveStudents.length} murid tidak aktif`,
      detail: names + (input.inactiveStudents.length > 3 ? ", …" : ""),
      reason: en
        ? "No learning activity for over 7 days — risk of falling behind."
        : `Tanpa aktivitas belajar ${">"} 7 hari — risiko tertinggal.`,
      priority: 3,
      href: "/teacher/analytics",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "digest-clear",
      title: en ? "No urgent action needed" : "Tidak ada tindakan mendesak",
      detail: en
        ? "The grading queue is empty, no alerts are open, and all students are active."
        : "Antrian nilai kosong, tidak ada peringatan terbuka, semua murid aktif.",
      reason: (en ? "Monitored at " : "Dipantau pada ") + now.toISOString(),
      priority: 3,
      href: "/teacher",
    });
  }

  return actions.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).slice(0, 3);
}

export interface DistributionBucket {
  /** Rentang inklusif-eksklusif (kecuali ujung atas inklusif): "0%", "1–24%", … */
  label: string;
  count: number;
}

export interface PercentDistribution {
  buckets: DistributionBucket[];
  /** Jumlah nilai yang dianalisis (sample size). */
  n: number;
  /** Rata-rata (persen). */
  meanPct: number;
}

const DIST_BUCKET_LABELS = ["0%", "1–24%", "25–49%", "50–74%", "75–99%", "100%"] as const;

/**
 * Histogram nilai persen (0..100) ke 6 ember tetap. Batas: [0,0], (0,25),
 * [25,50), [50,75), [75,100), [100,100]. Deterministik dan dapat direkonsiliasi
 * (jumlah ember = n). Bila semua nilai kosong → n = 0, ember semua 0.
 */
export function percentDistribution(values: number[]): PercentDistribution {
  const counts = [0, 0, 0, 0, 0, 0];
  let sum = 0;
  for (const raw of values) {
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    let idx = 5; // 100
    if (v <= 0) idx = 0;
    else if (v < 25) idx = 1;
    else if (v < 50) idx = 2;
    else if (v < 75) idx = 3;
    else if (v < 100) idx = 4;
    counts[idx] = (counts[idx] ?? 0) + 1;
    sum += v;
  }
  const buckets = DIST_BUCKET_LABELS.map((label, i) => ({ label, count: counts[i] ?? 0 }));
  const n = counts.reduce((a, b) => a + b, 0);
  return { buckets, n, meanPct: n > 0 ? sum / n : 0 };
}
