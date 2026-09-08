import type { TextDict } from "@/lib/i18n";

/** Teacher certificates `/teacher/certificates` surface (page + anchor buttons). */
export const CERT = {
  title: { id: "Sertifikat & anchoring", en: "Certificates & anchoring" },
  summary: {
    id: "{n} sertifikat ({active} active) · {pending} anchor pending",
    en: "{n} certificates ({active} active) · {pending} anchor pending",
  },
  batchAria: { id: "Anchor batch", en: "Anchor batch" },
  sectionTitle: { id: "Anchoring blockchain (opsional)", en: "Blockchain anchoring (optional)" },
  sectionBody: {
    id: "Batch payload hash sertifikat menjadi satu Merkle root lalu anchor via adapter (ADR-018). Hanya hash/root + transaksi yang disimpan — tanpa data pribadi.",
    en: "Batch certificate payload hashes into one Merkle root, then anchor via the adapter (ADR-018). Only hashes/root + the transaction reference are stored — no personal data.",
  },
  disabledNote: {
    id: "Anchoring nonaktif (BLOCKCHAIN_ANCHOR_ENABLED=false). Aktifkan + set BLOCKCHAIN_PROVIDER=mock (atau algorand-mock untuk jalur finality deterministik tanpa jaringan), atau pilih provider nyata setelah ADR-018 diputuskan.",
    en: "Anchoring is disabled (BLOCKCHAIN_ANCHOR_ENABLED=false). Enable it and set BLOCKCHAIN_PROVIDER=mock (or algorand-mock for a deterministic finality path without a network), or pick a real provider once ADR-018 is decided.",
  },
  empty: {
    id: "Belum ada sertifikat di kelas yang Anda ampu.",
    en: "No certificates in the classes you teach yet.",
  },
  student: { id: "Murid", en: "Student" },
  status: { id: "Status", en: "Status" },
  issued: { id: "Terbit", en: "Issued" },
  colCert: { id: "Sertifikat", en: "Certificate" },
  colBlockchain: { id: "Blockchain", en: "Blockchain" },
  verifyFootnote: {
    id: "Verifikasi publik: /verify/{public_id}. Anchor pending belum final dan tidak diklaim terverifikasi.",
    en: "Public verification: /verify/{public_id}. Pending anchors are not final and are never claimed as verified.",
  },

  // AnchorStatusChip (used by certificates list + student detail)
  chipNone: { id: "tidak di-anchor", en: "not anchored" },
  chipFinal: { id: "✓ anchor final", en: "✓ anchor final" },
  chipPending: { id: "anchor pending", en: "anchor pending" },
  chipFailed: { id: "anchor gagal", en: "anchor failed" },
  chipTxTitle: { id: "Transaksi: {ref}", en: "Transaction: {ref}" },

  // AnchorBatchButton
  errBlockchainDisabled: {
    id: "Anchoring blockchain nonaktif (BLOCKCHAIN_ANCHOR_ENABLED=false).",
    en: "Blockchain anchoring is disabled (BLOCKCHAIN_ANCHOR_ENABLED=false).",
  },
  errProviderPending: {
    id: "Provider belum dipilih (ADR-018) — hanya mode mock aktif.",
    en: "No provider selected yet (ADR-018) — only mock mode is active.",
  },
  errAnchorFailed: { id: "Anchor gagal — coba lagi nanti.", en: "Anchoring failed — try again later." },
  errAnchorEmpty: {
    id: "Batch kosong — tidak ada payload hash valid.",
    en: "The batch is empty — no valid payload hashes.",
  },
  errUnauthenticated: { id: "Sesi tidak valid.", en: "Invalid session." },
  errForbidden: { id: "Aksi ini hanya untuk guru aktif.", en: "This action is for active teachers only." },
  batchIdle: { id: "Anchor batch sertifikat", en: "Anchor certificate batch" },
  batchBusy: { id: "Meng-anchor…", en: "Anchoring…" },
  batchNoNew: {
    id: "Tidak ada sertifikat baru untuk di-anchor (semua sudah ter-anchor).",
    en: "No new certificates to anchor (all are already anchored).",
  },
  batchOk: {
    id: "{n} sertifikat di-anchor (Merkle root {root}…, status {status}){ref}.",
    en: "{n} certificates anchored (Merkle root {root}…, status {status}){ref}.",
  },
  batchRef: { id: " · tx {ref}", en: " · tx {ref}" },
  failed: { id: "Gagal: {msg}", en: "Failed: {msg}" },

  // AnchorRefreshButton
  refreshIdle: { id: "Refresh status anchor", en: "Refresh anchor status" },
  refreshBusy: { id: "Memeriksa status…", en: "Checking status…" },
  refreshNone: {
    id: "Tidak ada anchor pending yang naik ke final saat ini.",
    en: "No pending anchors advanced to final right now.",
  },
  refreshOk: {
    id: "{n} anchor pending kini final.",
    en: "{n} pending anchors are now final.",
  },
} as const satisfies TextDict;
