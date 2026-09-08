import type { TextDict } from "@/lib/i18n";

/** Halaman detail murid (guru) — bagian Mastery & bukti kompetensi (AC-53). */
export const STUDENT_DETAIL: TextDict = {
  masteryEvidence: { id: "Mastery & bukti kompetensi", en: "Competency mastery & evidence" },
  masteryEvidenceBody: {
    id: "Mastery dihitung dari attempt nyata (nilai terbaik per assessment, berbobot activity_competencies). Tiap baris tertelusur ke attempt, revisi nilai, dan rubrik yang dipakai saat finalize.",
    en: "Mastery is computed from real attempts (best score per assessment, weighted by activity_competencies). Every row is traceable to an attempt, a grade revision, and the rubric used at finalize.",
  },
  noCompetencyEvidence: {
    id: "Belum ada bukti mastery (tidak ada attempt bernilai pada assessment yang terhubung kompetensi).",
    en: "No mastery evidence yet (no scored attempt on competency-linked assessments).",
  },
  mastery: { id: "Mastery", en: "Mastery" },
  noEvidence: { id: "belum ada bukti", en: "no evidence yet" },
  best: { id: "Terbaik", en: "Best" },
  status: { id: "Status", en: "Status" },
  score: { id: "Skor", en: "Score" },
  rubricUsed: { id: "Rubrik", en: "Rubric" },
  revisions: { id: "Revisi nilai", en: "Score revisions" },
  noAttempts: { id: "Belum ada attempt.", en: "No attempts yet." },
} as const;
