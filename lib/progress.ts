import type { Lang } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";

export type EntityStatus = "locked" | "available" | "in_progress" | "submitted" | "completed";

export interface PrereqEdge {
  targetId: string;
  requiredIds: string[];
}

export function computeUnlock(
  allIds: string[],
  completedIds: Set<string>,
  edges: PrereqEdge[],
): Map<string, EntityStatus> {
  const out = new Map<string, EntityStatus>();
  const edgeByTarget = new Map(edges.map((e) => [e.targetId, e]));
  for (const id of allIds) {
    if (completedIds.has(id)) {
      out.set(id, "completed");
      continue;
    }
    const reqs = edgeByTarget.get(id)?.requiredIds ?? [];
    const unlocked = reqs.every((r) => completedIds.has(r));
    out.set(id, unlocked ? "available" : "locked");
  }
  return out;
}

export interface NextActionCandidate {
  id: string;
  title: string;
  mastery: number; // 0-1 terendah = prioritas remedial
  deadlineInDays: number | null;
  locked: boolean;
  lastActivityDaysAgo: number | null;
}

export function nextBestAction(
  candidates: NextActionCandidate[],
  lang: Lang = "id",
): { id: string; reason: string } | null {
  const open = candidates.filter((c) => !c.locked);
  if (open.length === 0) return null;
  // 1. deadline < 3 hari
  const urgent = open.filter((c) => c.deadlineInDays !== null && c.deadlineInDays <= 3);
  if (urgent.length > 0) {
    urgent.sort((a, b) => (a.deadlineInDays ?? 99) - (b.deadlineInDays ?? 99));
    const pick = urgent[0];
    if (pick)
      return {
        id: pick.id,
        reason: fmt(
          lang === "en"
            ? 'Deadline in {days} days — finish "{title}" first.'
            : 'Deadline {days} hari lagi — selesaikan "{title}" dulu.',
          { days: pick.deadlineInDays ?? 0, title: pick.title },
        ),
      };
  }
  // 2. mastery terendah
  const sorted = [...open].sort((a, b) => a.mastery - b.mastery);
  const pick = sorted[0];
  if (!pick) return null;
  if (pick.mastery < 0.7)
    return {
      id: pick.id,
      reason: fmt(
        lang === "en"
          ? 'Mastery of "{title}" is still {pct}% — remediate before moving on.'
          : 'Mastery "{title}" masih {pct}% — remedial dulu sebelum lanjut.',
        { title: pick.title, pct: Math.round(pick.mastery * 100) },
      ),
    };
  return {
    id: pick.id,
    reason: fmt(
      lang === "en"
        ? 'Continue "{title}" — prerequisites are met.'
        : 'Lanjutkan "{title}" — prerequisite terpenuhi.',
      { title: pick.title },
    ),
  };
}

export interface RiskSignal {
  code: "INACTIVE" | "REPEATED_ATTEMPTS" | "RUSH_LOW_ACCURACY" | "LOW_PREREQ" | "DEADLINE_BEHIND";
  message: string;
}

export function detectRisk(
  input: {
    inactiveDays: number;
    attemptsLast7d: number;
    scoreDelta: number;
    avgSecondsPerItem: number;
    accuracy: number;
    prereqMastery: number;
    progressPct: number;
    expectedPct: number;
  },
  lang: Lang = "id",
): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const shownInactive = input.inactiveDays > 30 ? "30+" : String(input.inactiveDays);
  if (input.inactiveDays > 7)
    signals.push({
      code: "INACTIVE",
      // Tampilan dibatasi "30+" agar angka fallback teknis (mis. 999 = tanpa
      // aktivitas tercatat) tidak tampil mentah ke guru; logika ambang tak berubah.
      message: fmt(
        lang === "en"
          ? "Inactive for {days} days — reach out and offer a reschedule."
          : "Tidak aktif {days} hari — sapa dan tawarkan jadwal ulang.",
        { days: shownInactive },
      ),
    });
  if (input.attemptsLast7d >= 3 && input.scoreDelta <= 0)
    signals.push({
      code: "REPEATED_ATTEMPTS",
      message: fmt(
        lang === "en"
          ? "{n} attempts without improvement — give gradual hints."
          : "{n} attempt tanpa peningkatan — beri hint bertahap.",
        { n: input.attemptsLast7d },
      ),
    });
  if (input.avgSecondsPerItem < 20 && input.accuracy < 0.5)
    signals.push({
      code: "RUSH_LOW_ACCURACY",
      message:
        lang === "en"
          ? "Working very fast with low accuracy — invite reflection, not blame."
          : "Mengerjakan sangat cepat dengan akurasi rendah — ajak refleksi, bukan tuduhan.",
    });
  if (input.prereqMastery < 0.6)
    signals.push({
      code: "LOW_PREREQ",
      message: fmt(
        lang === "en"
          ? "Prerequisite mastery is {pct}% — remediate first."
          : "Mastery prerequisite {pct}% — remedial dulu.",
        { pct: Math.round(input.prereqMastery * 100) },
      ),
    });
  if (input.expectedPct - input.progressPct > 15)
    signals.push({
      code: "DEADLINE_BEHIND",
      message: fmt(
        lang === "en"
          ? "Progress {p}% is behind the {e}% target."
          : "Progress {p}% tertinggal dari target {e}%.",
        { p: input.progressPct, e: input.expectedPct },
      ),
    });
  return signals;
}
