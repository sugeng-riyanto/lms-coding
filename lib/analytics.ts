/** Agregasi analytics murni (Prompt 07): dapat direkonsiliasi dengan fixture raw. */

export interface StudentRow {
  studentId: string;
  displayName: string;
  progressPct: number;
  mastery: number;
  lastActivityAt: string | null;
  submittedCount: number;
}

export interface CohortSummary {
  enrolled: number;
  active7d: number;
  avgProgress: number;
  avgMastery: number;
  needsAttention: number;
}

/** Rekonsiliasi: ringkasan = fungsi deterministik dari rows + now. */
export function summarizeCohort(rows: StudentRow[], now = new Date()): CohortSummary {
  const enrolled = rows.length;
  const active7d = rows.filter((r) => {
    if (!r.lastActivityAt) return false;
    return now.getTime() - Date.parse(r.lastActivityAt) <= 7 * 86400000;
  }).length;
  const avg = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const avgProgress = avg(rows.map((r) => r.progressPct));
  const avgMastery = avg(rows.map((r) => r.mastery));
  const needsAttention = rows.filter((r) => {
    const inactive = !r.lastActivityAt || now.getTime() - Date.parse(r.lastActivityAt) > 7 * 86400000;
    return inactive || r.progressPct < 50;
  }).length;
  return { enrolled, active7d, avgProgress, avgMastery, needsAttention };
}

/** Definisi metrik berversi (ANALYTICS.md: jangan ubah makna diam-diam). */
export const METRIC_DEFINITIONS_VERSION = "2026-09-06/v1";
