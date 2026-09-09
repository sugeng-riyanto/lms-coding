import type { TextDict } from "@/lib/i18n";

/** Teacher grading queue: `/teacher/grading` page + GradeQueue + RubricGradePanel. */
export const GRADING = {
  // Page shell
  title: { id: "Antrian penilaian manual", en: "Manual grading queue" },
  subtitle: {
    id: "Esai & proyek. Perubahan nilai tercatat sebagai revisi + audit.",
    en: "Essays & projects. Score changes are recorded as revisions + audit.",
  },

  // Queue item
  queueEmpty: { id: "Antrian kosong. 🎉", en: "Queue empty. 🎉" },
  gradeAria: { id: "Nilai {name}", en: "Grade {name}" },
  attemptHeader: {
    id: "{student} · attempt #{no} ({status})",
    en: "{student} · attempt #{no} ({status})",
  },
  questionLabel: { id: "Soal [{type}]:", en: "Question [{type}]:" },
  answerLabel: { id: "Jawaban:", en: "Answer:" },
  revisionLine: {
    id: "Revisi: {prev} → {next} · {reason} · {at}",
    en: "Revision: {prev} → {next} · {reason} · {at}",
  },

  // AI draft block
  aiDraftBlockAria: { id: "Draf AI", en: "AI draft" },
  aiBlockedEnv: {
    id: "Fitur AI nonaktif (AI_FEEDBACK_ENABLED=false).",
    en: "AI feature disabled (AI_FEEDBACK_ENABLED=false).",
  },
  aiBlockedConsent: {
    id: "Organisasi belum menyetujui penggunaan AI.",
    en: "Organization has not consented to AI use.",
  },
  aiBlockedDisabled: { id: "Saran draf AI (nonaktif)", en: "AI draft suggestion (disabled)" },
  requestDraft: { id: "Saran draf AI", en: "AI draft suggestion" },
  requesting: { id: "Meminta…", en: "Requesting…" },
  requestDraftRejected: {
    id: "Minta draf AI baru (yang lama ditolak)",
    en: "Request a new AI draft (previous rejected)",
  },
  draftLabel: { id: "DRAFT AI — perlu persetujuan guru", en: "AI DRAFT — requires teacher approval" },
  modelLabel: { id: "Model: {model}", en: "Model: {model}" },
  approve: { id: "Setujui & pakai", en: "Approve & use" },
  approving: { id: "Menyetujui…", en: "Approving…" },
  reject: { id: "Tolak", en: "Reject" },
  rejecting: { id: "Menolak…", en: "Rejecting…" },
  draftApproved: {
    id: "✓ Draf AI disetujui — feedback sudah terpasang (penanda ai_approved, audit tercatat).",
    en: "✓ AI draft approved — feedback attached (ai_approved flag, audit recorded).",
  },

  // Manual score block
  scoreLabel: { id: "Skor manual (0–100)", en: "Manual score (0–100)" },
  feedbackLabel: { id: "Feedback", en: "Feedback" },
  saveScore: { id: "Simpan nilai", en: "Save score" },
  saving: { id: "Menyimpan…", en: "Saving…" },

  // Post-release correction (nilai sudah pernah disimpan)
  correctionBadge: { id: "Koreksi nilai pasca-release", en: "Post-release correction" },
  correctionHint: {
    id: "Nilai sudah disimpan. Ubah untuk mengoreksi — revisi lama→baru & audit dicatat otomatis.",
    en: "Score already saved. Edit to correct — the old→new revision & audit are recorded automatically.",
  },
  attemptScoreLabel: { id: "Skor attempt saat ini", en: "Current attempt score" },
  saveCorrection: { id: "Simpan koreksi", en: "Save correction" },
  noticeCorrected: {
    id: "Koreksi tersimpan — revisi lama→baru + audit tercatat, murid melihat skor terbaru.",
    en: "Correction saved — old→new revision + audit recorded, student sees the latest score.",
  },

  // Notices
  noticeSaved: { id: "Nilai tersimpan (revisi tercatat).", en: "Score saved (revision recorded)." },
  noticeDraftCreated: {
    id: "Draf AI dibuat — tinjau sebelum menyetujui.",
    en: "AI draft created — review before approving.",
  },
  noticeDraftApproved: {
    id: "Draf AI disetujui — feedback terpasang (audit tercatat).",
    en: "AI draft approved — feedback attached (audit recorded).",
  },
  noticeDraftRejected: { id: "Draf AI ditolak.", en: "AI draft rejected." },
  failPrefix: { id: "Gagal: {error}", en: "Failed: {error}" },

  // AI error codes
  errAiDisabled: { id: "Fitur AI nonaktif.", en: "AI feature disabled." },
  errAiProviderUnconfigured: {
    id: "Provider AI belum dikonfigurasi.",
    en: "AI provider is not configured.",
  },
  errAiNoConsent: {
    id: "Organisasi belum menyetujui penggunaan AI.",
    en: "Organization has not consented to AI use.",
  },
  errAiProviderError: {
    id: "Provider AI gagal merespons — coba lagi.",
    en: "AI provider failed to respond — try again.",
  },
  errDraftFailed: { id: "Gagal menyimpan draf.", en: "Failed to save draft." },
  errApproveFailed: { id: "Gagal menyetujui draf.", en: "Failed to approve draft." },
  errRejectFailed: { id: "Gagal menolak draf.", en: "Failed to reject draft." },
  errAlreadyApproved: { id: "Draf sudah disetujui.", en: "Draft already approved." },
  errNotFound: { id: "Data tidak ditemukan.", en: "Data not found." },
} as const satisfies TextDict;

/** Map a server AI-error code to a dictionary key. */
export const AI_ERROR_KEY: Record<string, keyof typeof GRADING> = {
  AI_DISABLED: "errAiDisabled",
  AI_PROVIDER_UNCONFIGURED: "errAiProviderUnconfigured",
  AI_NO_CONSENT: "errAiNoConsent",
  AI_PROVIDER_ERROR: "errAiProviderError",
  DRAFT_FAILED: "errDraftFailed",
  APPROVE_FAILED: "errApproveFailed",
  REJECT_FAILED: "errRejectFailed",
  ALREADY_APPROVED: "errAlreadyApproved",
  NOT_FOUND: "errNotFound",
};

/** RubricGradePanel (shared component used by the grading queue). */
export const RUBRIC_PANEL = {
  rubricTitle: { id: "Penilaian rubrik: {title}", en: "Rubric grading: {title}" },
  statusFinal: {
    id: "sudah final — nilai manual terhitung",
    en: "final — manual score computed",
  },
  statusDraft: { id: "draf — belum terhitung", en: "draft — not yet computed" },
  maxPoints: { id: "(maks {max} poin)", en: "(max {max} points)" },
  finalBadge: { id: "final", en: "final" },
  scoreLabel: { id: "Skor", en: "Score" },
  feedbackLabel: { id: "Feedback kriteria", en: "Criterion feedback" },
  feedbackPlaceholder: {
    id: "Catatan untuk kriteria ini (terlihat murid setelah release).",
    en: "Note for this criterion (visible to the student after release).",
  },
  saveDraft: { id: "Simpan sebagai draf", en: "Save as draft" },
  savingDraft: { id: "Menyimpan draf…", en: "Saving draft…" },
  finalize: { id: "Finalize nilai", en: "Finalize scores" },
  finalizing: { id: "Memfinalisasi…", en: "Finalizing…" },
  alreadyFinal: { id: "Nilai sudah final", en: "Scores already final" },
  fillAll: {
    id: "Isi skor untuk semua kriteria terlebih dahulu (0 boleh).",
    en: "Fill in a score for every criterion first (0 is allowed).",
  },
  saveCriterionFail: {
    id: 'Gagal menyimpan kriteria "{title}": {error}',
    en: 'Failed to save criterion "{title}": {error}',
  },
  finalizeFail: { id: "Gagal finalisasi: {error}", en: "Finalization failed: {error}" },
} as const satisfies TextDict;
