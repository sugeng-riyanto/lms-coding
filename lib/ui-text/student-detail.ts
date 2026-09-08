import type { TextDict } from "@/lib/i18n";

/** Halaman detail murid (guru) — mastery (AC-53) + history + sertifikat + approval. */
export const STUDENT_DETAIL: TextDict = {
  // ---- mastery evidence (AC-53) ----
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

  // ---- page shell ----
  loadFailed: { id: "Detail murid tidak dapat dimuat.", en: "Student details could not be loaded." },
  backToDashboard: { id: "← Dashboard", en: "← Dashboard" },
  statusLine: { id: "Status: {status} · {courses}", en: "Status: {status} · {courses}" },

  // ---- attempt history ----
  attemptHistory: { id: "Riwayat attempt", en: "Attempt history" },
  attemptLine: {
    id: "#{no} · {status} · skor {score} · {at}",
    en: "#{no} · {status} · score {score} · {at}",
  },

  // ---- grade revisions (audit) ----
  revisionsHeading: { id: "Revisi nilai (audit)", en: "Score revisions (audit)" },
  noRevisions: { id: "Tidak ada revisi.", en: "No revisions." },
  revisionLine: { id: "{attempt}: {prev} → {next} · {reason}", en: "{attempt}: {prev} → {next} · {reason}" },

  // ---- learning timeline ----
  timelineHeading: { id: "Timeline belajar", en: "Learning timeline" },
  noEvents: { id: "Belum ada event.", en: "No events yet." },
  eventLine: { id: "{type} · {at}", en: "{type} · {at}" },

  // ---- certificates ----
  certificatesHeading: { id: "Sertifikat", en: "Certificates" },
  noCertificates: { id: "Belum ada sertifikat.", en: "No certificates yet." },
  certActive: { id: "active", en: "active" },
  certRevoked: { id: "revoked", en: "revoked" },
  replaced: { id: "diganti", en: "replaced" },

  // ---- issuance approval ----
  issuanceHeading: { id: "Penerbitan (approval guru)", en: "Issuance (teacher approval)" },
  issuanceBody: {
    id: "Eligibility dievaluasi server; alasan penolakan ditampilkan bila belum layak.",
    en: "Eligibility is evaluated server-side; rejection reasons are shown when not eligible.",
  },
  certStatusLabel: { id: "sertifikat {status}", en: "certificate {status}" },
  notIssued: { id: "belum terbit", en: "not issued" },

  // ---- issue button ----
  issueConfirm: {
    id: "Terbitkan sertifikat? Eligibility dicek server.",
    en: "Issue certificate? Eligibility is checked server-side.",
  },
  checking: { id: "Memeriksa…", en: "Checking…" },
  issueButton: { id: "Terbitkan", en: "Issue" },
  issued: { id: "Sertifikat terbit.", en: "Certificate issued." },
  notEligible: { id: "Belum eligible:", en: "Not yet eligible:" },
  failed: { id: "Gagal: {error}", en: "Failed: {error}" },

  // ---- reissue button ----
  reasonTooShort: { id: "Alasan minimal {n} karakter.", en: "Reason must be at least {n} characters." },
  reissueNotEligible: {
    id: "Belum eligible — sertifikat lama tidak diubah:",
    en: "Not yet eligible — the old certificate is unchanged:",
  },
  notActive: {
    id: "Sertifikat tidak lagi aktif. Muat ulang halaman.",
    en: "The certificate is no longer active. Reload the page.",
  },
  notFoundForbidden: {
    id: "Sertifikat tidak ditemukan atau di luar cohort Anda.",
    en: "Certificate not found or outside your cohort.",
  },
  reissueFailed: { id: "Reissue gagal. Silakan coba lagi.", en: "Reissue failed. Please try again." },
  reissueButton: { id: "Reissue", en: "Reissue" },
  reissueTitle: { id: "Reissue sertifikat {serialNo}", en: "Reissue certificate {serialNo}" },
  reissueBody: {
    id: "Sertifikat lama akan di-revoke dan sertifikat baru diterbitkan dalam satu transaksi. Eligibility dicek ulang server-side; alasan dicatat di audit log.",
    en: "The old certificate is revoked and a new one issued in a single transaction. Eligibility is re-checked server-side; the reason is recorded in the audit log.",
  },
  reasonLabel: { id: "Alasan reissue", en: "Reissue reason" },
  required: { id: "(wajib)", en: "(required)" },
  cancel: { id: "Batal", en: "Cancel" },
  processing: { id: "Memproses…", en: "Processing…" },
} as const;
