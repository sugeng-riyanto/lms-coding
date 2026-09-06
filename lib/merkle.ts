import { createHash } from "node:crypto";

/**
 * Merkle batch untuk chain anchoring (Prompt 09): gabungkan banyak
 * certificate hash menjadi satu root agar biaya anchor rendah.
 * Hanya hash yang naik ke chain — tanpa PII/nilai (ADR-001).
 */
export function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function pairHash(left: string, right: string): string {
  return sha256Hex(left + right);
}

export function merkleRoot(leaves: string[]): string | null {
  if (leaves.length === 0) return null;
  let level = [...leaves].sort();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i] as string;
      const right = (level[i + 1] ?? left) as string;
      next.push(pairHash(left, right));
    }
    level = next;
  }
  return level[0] ?? null;
}

export interface MerkleProof {
  leaf: string;
  siblings: { hash: string; left: boolean }[];
  root: string;
}

/** Proof untuk satu leaf (unbalanced: node ganjil dipasangkan dengan dirinya). */
export function merkleProof(leaves: string[], index: number): MerkleProof | null {
  if (leaves.length === 0 || index < 0 || index >= leaves.length) return null;
  const sorted = [...leaves].sort();
  const leaf = sorted[index] as string;
  // Lacak posisi leaf setelah sort tidak didukung — proof dihitung pada urutan sort.
  let idx = sorted.indexOf(leaf);
  let level = [...sorted];
  const siblings: { hash: string; left: boolean }[] = [];
  while (level.length > 1) {
    const isRight = idx % 2 === 1;
    let sibIdx: number;
    if (isRight) sibIdx = idx - 1;
    else sibIdx = idx + 1 < level.length ? idx + 1 : idx; // ganjil dipasangkan dengan dirinya
    siblings.push({ hash: level[sibIdx] as string, left: isRight });
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i] as string;
      const right = (level[i + 1] ?? left) as string;
      next.push(pairHash(left, right));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return { leaf, siblings, root: level[0] as string };
}

export function verifyProof(proof: MerkleProof): boolean {
  let acc = proof.leaf;
  for (const s of proof.siblings) {
    acc = s.left ? pairHash(s.hash, acc) : pairHash(acc, s.hash);
  }
  return acc === proof.root;
}
