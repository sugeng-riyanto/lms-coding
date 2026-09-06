// Blockchain anchoring opsional (Prompt 09; ADR-001/ADR-018).
//
// Interface: anchor(rootHash) / getStatus(reference) / verify(rootHash, reference).
// Batch Merkle ada di lib/merkle.ts — hanya hash/root + transaction reference yang
// disimpan/di-chain, TANPA PII (nama, email, nilai, student ID, jawaban, PDF).
//
// ADR-018 (proposed): provider/network BELUM dipilih — keputusan manusia pending.
//   - BLOCKCHAIN_ANCHOR_ENABLED=false default → NoopChainAdapter.
//   - enabled + BLOCKCHAIN_PROVIDER=mock → MockChainAdapter (tests/verifikasi).
//   - enabled + provider NYATA → NoopChainAdapter (DITOLAK runtime; tidak mengarang
//     kredensial/transaksi sampai keputusan manusia + kredensial aman tersedia).

export type ChainAnchorStatus = "not_configured" | "pending" | "final" | "failed";

export interface ChainAnchorResult {
  status: ChainAnchorStatus;
  reference: string | null;
}

export interface ChainAdapter {
  anchor(rootHash: string): Promise<ChainAnchorResult>;
  getStatus(reference: string): Promise<ChainAnchorResult>;
  verify(rootHash: string, reference: string): Promise<boolean>;
}

/** Stub: default OFF — tidak ada klaim chain, tidak ada PII/nilai. */
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

export interface MockChainAdapterOptions {
  /** Berapa kali getStatus sebelum final; Infinity = pending selamanya. Default 1. */
  confirmations?: number;
  /** anchor selalu gagal permanen (status failed). */
  failAnchor?: boolean;
  /** anchor gagal SEKALI (transient, lempar) lalu sukses — untuk uji retry. */
  failAnchorOnce?: boolean;
  /** provider tidak tersedia: getStatus/verify lempar. */
  unavailable?: boolean;
  /** anchor menolak setelah timeoutMs (simulasi timeout provider). */
  timeoutMs?: number;
}

interface MockAnchorRecord {
  root: string;
  reference: string;
  confirmations: number;
}

/**
 * Mock adapter deterministik (ADR-018): in-memory, tanpa jaringan.
 * Lifecycle: anchor → pending → (getStatus × confirmations) → final.
 */
export class MockChainAdapter implements ChainAdapter {
  private readonly anchors = new Map<string, MockAnchorRecord>();
  private readonly opts: Required<MockChainAdapterOptions>;
  private transientFailureUsed = false;

  constructor(options: MockChainAdapterOptions = {}) {
    this.opts = {
      confirmations: options.confirmations ?? 1,
      failAnchor: options.failAnchor ?? false,
      failAnchorOnce: options.failAnchorOnce ?? false,
      unavailable: options.unavailable ?? false,
      timeoutMs: options.timeoutMs ?? 0,
    };
  }

  private statusFor(confirmations: number): ChainAnchorStatus {
    return confirmations >= this.opts.confirmations ? "final" : "pending";
  }

  async anchor(rootHash: string): Promise<ChainAnchorResult> {
    if (this.opts.timeoutMs > 0) {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error("PROVIDER_TIMEOUT")), this.opts.timeoutMs),
      );
    }
    if (this.opts.failAnchor) return { status: "failed", reference: null };
    if (this.opts.failAnchorOnce && !this.transientFailureUsed) {
      this.transientFailureUsed = true;
      throw new Error("PROVIDER_TRANSIENT");
    }
    for (const a of this.anchors.values()) {
      if (a.root === rootHash) return { status: this.statusFor(a.confirmations), reference: a.reference };
    }
    const reference = `mock-anchor-${rootHash.slice(0, 12) || "root"}`;
    this.anchors.set(reference, { root: rootHash, reference, confirmations: 0 });
    return { status: "pending", reference };
  }

  async getStatus(reference: string): Promise<ChainAnchorResult> {
    if (this.opts.unavailable) throw new Error("PROVIDER_UNAVAILABLE");
    const a = this.anchors.get(reference);
    if (!a) return { status: "failed", reference };
    a.confirmations += 1;
    return { status: this.statusFor(a.confirmations), reference };
  }

  async verify(rootHash: string, reference: string): Promise<boolean> {
    if (this.opts.unavailable) throw new Error("PROVIDER_UNAVAILABLE");
    const a = this.anchors.get(reference);
    if (!a) return false;
    if (a.root !== rootHash) return false;
    return this.statusFor(a.confirmations) === "final";
  }
}

/** Retry anchor dengan backoff sederhana (transient timeout/failure). */
export async function anchorWithRetry(
  adapter: ChainAdapter,
  rootHash: string,
  options: { attempts?: number; baseDelayMs?: number } = {},
): Promise<ChainAnchorResult> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 0;
  let last: ChainAnchorResult = { status: "failed", reference: null };
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await adapter.anchor(rootHash);
      if (r.status !== "failed") return r;
      last = r;
    } catch {
      last = { status: "failed", reference: null };
    }
    if (i < attempts - 1 && baseDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs));
    }
  }
  return last;
}

export type AnchorVerifyOutcome = "verified" | "not_final" | "invalid" | "unavailable";

/**
 * Verifikasi dengan fallback: provider tidak tersedia → "unavailable" (UI tidak
 * mengklaim invalid/verified). Pending → "not_final". Final + cocok → "verified".
 */
export async function verifyAnchor(
  adapter: ChainAdapter,
  rootHash: string,
  reference: string,
): Promise<AnchorVerifyOutcome> {
  let ok: boolean;
  try {
    ok = await adapter.verify(rootHash, reference);
  } catch {
    return "unavailable";
  }
  if (ok) return "verified";
  let status: ChainAnchorStatus;
  try {
    status = (await adapter.getStatus(reference)).status;
  } catch {
    return "unavailable";
  }
  if (status === "pending") return "not_final";
  return "invalid";
}

export function isChainEnabled(): boolean {
  return process.env.BLOCKCHAIN_ANCHOR_ENABLED === "true";
}

/**
 * Seleksi adapter (ADR-018): mock untuk tests; provider nyata DITOLAK sampai
 * keputusan manusia + kredensial aman tersedia.
 */
export function getChainAdapter(): ChainAdapter {
  if (!isChainEnabled()) return new NoopChainAdapter();
  const provider = (process.env.BLOCKCHAIN_PROVIDER ?? "").trim().toLowerCase();
  if (provider === "mock") return new MockChainAdapter();
  return new NoopChainAdapter();
}
