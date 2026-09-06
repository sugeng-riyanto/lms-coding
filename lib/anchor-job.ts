// Batch anchoring (Prompt 09 slice; ADR-018).
//
// Alur job: kumpulkan payload_hash sertifikat aktif yang BELUM ter-anchor →
// bangun satu Merkle root (lib/merkle.ts) → anchor via ChainAdapter →
// simpan baris chain_anchors + tautkan sertifikat. Hanya hash/root + tx
// reference yang disimpan (tanpa PII/nilai). Idempoten: root yang sama
// (crash-window antara anchor sukses dan link gagal) di-link ke baris yang
// sudah ada, bukan anchor ulang.
//
// Orchestrator murni terhadap I/O: semua akses data lewat deps yang di-inject,
// sehingga unit test memakai store in-memory + MockChainAdapter tanpa DB.

import { merkleRoot } from "@/lib/merkle";
import type { ChainAdapter, ChainAnchorStatus } from "@/lib/chain";

export const ANCHOR_BATCH_LIMIT = 200;

export interface AnchorCandidate {
  certificateId: string;
  payloadHash: string;
}

/** Sertifikat pantas di-anchor: active, belum ter-anchor, punya payload hash. */
export function isAnchorEligible(c: {
  status: string;
  chain_anchor_id: string | null;
  payload_hash: string | null;
}): boolean {
  return c.status === "active" && c.chain_anchor_id === null && Boolean(c.payload_hash);
}

/** Ambil batch kandidat (urut id agar deterministik) dalam batas. */
export function collectAnchorCandidates(
  rows: { id: string; status: string; chain_anchor_id: string | null; payload_hash: string | null }[],
  limit = ANCHOR_BATCH_LIMIT,
): AnchorCandidate[] {
  return rows
    .filter(isAnchorEligible)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((r) => ({ certificateId: r.id, payloadHash: r.payload_hash as string }));
}

export interface AnchorInsertRow {
  provider: string;
  network: string;
  transaction_ref: string | null;
  merkle_root: string;
  status: ChainAnchorStatus;
  organization_id?: string | null;
}

export interface ExistingAnchor {
  id: string;
  status: string;
  transaction_ref: string | null;
}

export interface AnchorBatchDeps {
  /** Kandidat belum ter-anchor, sudah di-scope org oleh caller (≤ ANCHOR_BATCH_LIMIT). */
  findCandidates(): Promise<AnchorCandidate[]>;
  /** Baris chain_anchors dengan merkle_root sama di org ini (dedup crash-window). */
  findAnchorByRoot(rootHash: string): Promise<ExistingAnchor | null>;
  insertAnchor(row: AnchorInsertRow): Promise<string>;
  linkCertificates(anchorId: string, certificateIds: string[]): Promise<void>;
  adapter: ChainAdapter;
  provider: string;
  network: string;
  organizationId?: string | null;
}

export type AnchorBatchOutcome =
  | {
      ok: true;
      anchored: number;
      root: string | null;
      reference: string | null;
      status: ChainAnchorStatus;
    }
  | { ok: false; reason: "no_candidates" | "empty_hashes" | "anchor_failed"; root: string | null };

export async function runAnchorBatch(deps: AnchorBatchDeps): Promise<AnchorBatchOutcome> {
  const candidates = (await deps.findCandidates()).slice(0, ANCHOR_BATCH_LIMIT);
  if (candidates.length === 0) return { ok: false as const, reason: "no_candidates", root: null };

  const root = merkleRoot(candidates.map((c) => c.payloadHash));
  if (!root) return { ok: false as const, reason: "empty_hashes", root: null };

  // Crash-window: anchor sukses tapi link gagal → link ke baris yang sudah ada.
  const existing = await deps.findAnchorByRoot(root);
  if (existing) {
    await deps.linkCertificates(
      existing.id,
      candidates.map((c) => c.certificateId),
    );
    return {
      ok: true as const,
      anchored: candidates.length,
      root,
      reference: existing.transaction_ref,
      status: (existing.status === "pending" || existing.status === "final" ? existing.status : "pending") as
        "pending" | "final",
    };
  }

  const result = await deps.adapter.anchor(root);
  if (result.status === "failed" || result.status === "not_configured") {
    return { ok: false as const, reason: "anchor_failed", root };
  }

  const anchorId = await deps.insertAnchor({
    provider: deps.provider,
    network: deps.network,
    transaction_ref: result.reference,
    merkle_root: root,
    status: result.status,
    organization_id: deps.organizationId ?? null,
  });
  await deps.linkCertificates(
    anchorId,
    candidates.map((c) => c.certificateId),
  );
  return {
    ok: true as const,
    anchored: candidates.length,
    root,
    reference: result.reference,
    status: result.status,
  };
}
