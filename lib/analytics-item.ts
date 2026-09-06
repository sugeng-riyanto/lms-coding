/**
 * Item analysis & misconception map — logika MURNI (tanpa I/O), sesuai
 * ANALYTICS.md: difficulty, discrimination sederhana, omit rate, dan
 * misconception map dari distractor terpilih.
 *
 * Konvensi (ANALYTICS.md): definisi metrik berversi; hasil deterministik dan
 * dapat direkonsiliasi dari baris raw; cohort kecil ditandai (n + guard
 * minGroupN), bukan klaim absolut; tidak ada ranking publik (fungsi murni
 * tanpa konteks "publik").
 *
 * Populasi tiap metrik = responses soal pilihan (single_choice / true_false /
 * multiple_choice) pada attempt yang BUKAN draft (not_started/in_progress).
 * Pemfilteran draft ada DI DALAM fungsi agar penyebut difficulty, omit, dan
 * distractor tidak pernah berbeda.
 */
import type { QuestionType } from "@/lib/grading";

export const ITEM_METRIC_DEFINITIONS_VERSION = "2026-09-06/v1";

/** Status attempt yang tidak boleh masuk statistik item. */
export const ATTEMPT_DRAFT_STATUSES = ["not_started", "in_progress"] as const;

/** Ukuran kelompok atas/bawah minimum untuk discrimination (anti cohort kecil). */
export const DEFAULT_MIN_GROUP_N = 3;

export type ChoiceQuestionType = Extract<QuestionType, "single_choice" | "true_false" | "multiple_choice">;

/** Satu response flattened hasil query halaman (dirakit di server, bukan di sini). */
export interface ItemResponseRow {
  questionId: string;
  attemptId: string;
  studentId: string;
  displayName: string;
  questionType: ChoiceQuestionType;
  /** Teks prompt/opsi — hanya untuk tampilan; tidak dipakai dalam kalkulasi. */
  promptText: string;
  /** Kunci benar versi soal yang dijawab. */
  correctOptionIds: string[];
  /** Opsi yang dipilih murid ([] = dikosongkan/omit). */
  chosenOptionIds: string[];
  attemptStatus: string;
  /** Skor total attempt (%) — dasar bucket atas/bawah discrimination. */
  assessmentTotalPct: number;
}

export function isEligibleForItemAnalysis(row: ItemResponseRow): boolean {
  return !(ATTEMPT_DRAFT_STATUSES as readonly string[]).includes(row.attemptStatus);
}

/**
 * Correct = pilihan PERSIS sama dengan kunci (single/true_false: 1 opsi;
 * multiple_choice: subset-pun dianggap salah — konsisten `autoGrade` exact
 * match). Kosong tidak pernah benar.
 */
export function isCorrectResponse(row: ItemResponseRow): boolean {
  const chosen = row.chosenOptionIds;
  const expected = row.correctOptionIds;
  if (chosen.length === 0 || chosen.length !== expected.length) return false;
  const expectedSet = new Set(expected);
  return chosen.every((id) => expectedSet.has(id));
}

export function isOmittedResponse(row: ItemResponseRow): boolean {
  return row.chosenOptionIds.length === 0;
}

export interface QuestionItemStats {
  questionId: string;
  questionType: ChoiceQuestionType;
  promptText: string;
  /** Jumlah response eligible (attempt non-draft). */
  n: number;
  correct: number;
  /** Difficulty p = benar / n (0..1; rendah = sulit). */
  difficulty: number;
  /** Omit rate = dikosongkan / n (0..1). */
  omit: number;
  /**
   * Discrimination sederhana upper–lower = p(kelompok skor atas) −
   * p(kelompok skor bawah), tercile; null bila kelompok < minGroupN
   * (cohort kecil → tidak layak diklaim).
   */
  discrimination: number | null;
}

export interface DistractorCluster {
  optionId: string;
  /** Berapa kali opsi salah ini dipilih (di antara yang salah). */
  picked: number;
  /** picked / jumlah yang salah (0..1). */
  shareOfIncorrect: number;
  studentIds: string[];
  studentNames: string[];
}

export interface QuestionDistractorMap {
  questionId: string;
  n: number;
  correct: number;
  /** Jawab salah dengan setidaknya satu pilihan (kosong tidak masuk cluster). */
  incorrect: number;
  /** Urut shareOfIncorrect turun, lalu optionId naik (deterministik). */
  clusters: DistractorCluster[];
}

type Grouped = Map<string, ItemResponseRow[]>;

function groupByQuestion(rows: ItemResponseRow[]): Grouped {
  const groups: Grouped = new Map();
  for (const row of rows) {
    const g = groups.get(row.questionId);
    if (g) g.push(row);
    else groups.set(row.questionId, [row]);
  }
  return groups;
}

/** Urutan baris stabil per soal (studentId → attemptId) agar output deterministik. */
function sortRows(rows: ItemResponseRow[]): ItemResponseRow[] {
  return [...rows].sort(
    (a, b) => a.studentId.localeCompare(b.studentId) || a.attemptId.localeCompare(b.attemptId),
  );
}

/** p(kelompok atas) − p(kelompok bawah) berbasis tercile skor total attempt. */
function discrimination(rows: ItemResponseRow[], minGroupN: number): number | null {
  const sorted = [...rows].sort(
    (a, b) =>
      a.assessmentTotalPct - b.assessmentTotalPct ||
      a.studentId.localeCompare(b.studentId) ||
      a.attemptId.localeCompare(b.attemptId),
  );
  const n = sorted.length;
  const groupSize = Math.ceil(n / 3);
  if (groupSize < minGroupN) return null; // n < 3×minGroupN tidak layak
  const p = (group: ItemResponseRow[]): number => group.filter(isCorrectResponse).length / group.length;
  const bottom = sorted.slice(0, groupSize);
  const top = sorted.slice(n - groupSize);
  return p(top) - p(bottom);
}

/** Statistik per soal atas populasi eligible. Array diurut questionId. */
export function itemStatistics(
  rows: ItemResponseRow[],
  opts: { minGroupN?: number } = {},
): QuestionItemStats[] {
  const minGroupN = opts.minGroupN ?? DEFAULT_MIN_GROUP_N;
  const eligible = rows.filter(isEligibleForItemAnalysis);
  const out: QuestionItemStats[] = [];
  for (const [questionId, groupRows] of groupByQuestion(eligible)) {
    const sorted = sortRows(groupRows);
    const n = sorted.length;
    const correct = sorted.filter(isCorrectResponse).length;
    const first = sorted[0]!; // grup selalu non-kosong
    out.push({
      questionId,
      questionType: first.questionType,
      promptText: first.promptText,
      n,
      correct,
      difficulty: n === 0 ? 0 : correct / n,
      omit: n === 0 ? 0 : sorted.filter(isOmittedResponse).length / n,
      discrimination: discrimination(sorted, minGroupN),
    });
  }
  out.sort((a, b) => a.questionId.localeCompare(b.questionId));
  return out;
}

/**
 * Misconception map dari distractor terpilih: untuk tiap opsi SALAH yang
 * dipilih pada jawaban salah, sebaran pemilihnya (murid + proporsi). Opsi
 * benar dan jawaban kosong tidak pernah masuk cluster. Output deterministik.
 */
export function distractorMap(rows: ItemResponseRow[]): QuestionDistractorMap[] {
  const eligible = rows.filter(isEligibleForItemAnalysis);
  const out: QuestionDistractorMap[] = [];
  for (const [questionId, groupRows] of groupByQuestion(eligible)) {
    const sorted = sortRows(groupRows);
    const n = sorted.length;
    const correct = sorted.filter(isCorrectResponse).length;
    const incorrectRows = sorted.filter((r) => !isCorrectResponse(r) && !isOmittedResponse(r));
    const incorrect = incorrectRows.length;

    const pickedByOption = new Map<string, string[]>();
    for (const row of incorrectRows) {
      const correctSet = new Set(row.correctOptionIds);
      const wrongChosen = row.chosenOptionIds.filter((id) => !correctSet.has(id));
      for (const optionId of new Set(wrongChosen)) {
        const list = pickedByOption.get(optionId) ?? [];
        list.push(row.studentId);
        pickedByOption.set(optionId, list);
      }
    }

    const nameById = new Map(sorted.map((r) => [r.studentId, r.displayName]));
    const clusters: DistractorCluster[] = [...pickedByOption.entries()]
      .map(([optionId, studentIds]) => ({
        optionId,
        picked: studentIds.length,
        shareOfIncorrect: incorrect === 0 ? 0 : studentIds.length / incorrect,
        studentIds,
        studentNames: studentIds.map((id) => nameById.get(id) ?? ""),
      }))
      .sort((a, b) => b.shareOfIncorrect - a.shareOfIncorrect || a.optionId.localeCompare(b.optionId));

    out.push({ questionId, n, correct, incorrect, clusters });
  }
  out.sort((a, b) => a.questionId.localeCompare(b.questionId));
  return out;
}
