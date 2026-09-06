export interface ChainAnchorResult {
  status: "not_configured" | "pending" | "anchored" | "failed";
  reference: string | null;
}

export interface ChainAdapter {
  anchor(rootHash: string): Promise<ChainAnchorResult>;
  getStatus(reference: string): Promise<ChainAnchorResult>;
  verify(rootHash: string, reference: string): Promise<boolean>;
}

/** Stub adapter: default OFF, tidak menyimpan PII/nilai di chain. */
export class NoopChainAdapter implements ChainAdapter {
  async anchor(_rootHash: string): Promise<ChainAnchorResult> {
    return { status: "not_configured", reference: null };
  }
  async getStatus(_reference: string): Promise<ChainAnchorResult> {
    return { status: "not_configured", reference: null };
  }
  async verify(_rootHash: string, _reference: string): Promise<boolean> {
    return false;
  }
}

export function isChainEnabled(): boolean {
  return process.env.BLOCKCHAIN_ANCHOR_ENABLED === "true";
}

export function getChainAdapter(): ChainAdapter {
  // Provider nyata hanya setelah ADR + evaluasi biaya/regulasi.
  return new NoopChainAdapter();
}
