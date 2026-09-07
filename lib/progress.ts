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

export function nextBestAction(candidates: NextActionCandidate[]): { id: string; reason: string } | null {
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
        reason: `Deadline ${pick.deadlineInDays} hari lagi — selesaikan "${pick.title}" dulu.`,
      };
  }
  // 2. mastery terendah
  const sorted = [...open].sort((a, b) => a.mastery - b.mastery);
  const pick = sorted[0];
  if (!pick) return null;
  if (pick.mastery < 0.7)
    return {
      id: pick.id,
      reason: `Mastery "${pick.title}" masih ${Math.round(pick.mastery * 100)}% — remedial dulu sebelum lanjut.`,
    };
  return { id: pick.id, reason: `Lanjutkan "${pick.title}" — prerequisite terpenuhi.` };
}

export interface RiskSignal {
  code: "INACTIVE" | "REPEATED_ATTEMPTS" | "RUSH_LOW_ACCURACY" | "LOW_PREREQ" | "DEADLINE_BEHIND";
  message: string;
}

export function detectRisk(input: {
  inactiveDays: number;
  attemptsLast7d: number;
  scoreDelta: number;
  avgSecondsPerItem: number;
  accuracy: number;
  prereqMastery: number;
  progressPct: number;
  expectedPct: number;
}): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (input.inactiveDays > 7)
    signals.push({
      code: "INACTIVE",
      // Tampilan dibatasi "30+" agar angka fallback teknis (mis. 999 = tanpa
      // aktivitas tercatat) tidak tampil mentah ke guru; logika ambang tak berubah.
      message: `Tidak aktif ${input.inactiveDays > 30 ? "30+" : input.inactiveDays} hari — sapa dan tawarkan jadwal ulang.`,
    });
  if (input.attemptsLast7d >= 3 && input.scoreDelta <= 0)
    signals.push({
      code: "REPEATED_ATTEMPTS",
      message: `${input.attemptsLast7d} attempt tanpa peningkatan — beri hint bertahap.`,
    });
  if (input.avgSecondsPerItem < 20 && input.accuracy < 0.5)
    signals.push({
      code: "RUSH_LOW_ACCURACY",
      message: "Mengerjakan sangat cepat dengan akurasi rendah — ajak refleksi, bukan tuduhan.",
    });
  if (input.prereqMastery < 0.6)
    signals.push({
      code: "LOW_PREREQ",
      message: `Mastery prerequisite ${Math.round(input.prereqMastery * 100)}% — remedial dulu.`,
    });
  if (input.expectedPct - input.progressPct > 15)
    signals.push({
      code: "DEADLINE_BEHIND",
      message: `Progress ${input.progressPct}% tertinggal dari target ${input.expectedPct}%.`,
    });
  return signals;
}
