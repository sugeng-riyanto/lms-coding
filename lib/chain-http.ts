// HttpChainAdapter shell — opsi rekomendasi ADR-018 (Algorand default), INERT
// sampai provider nyata dipilih manusia.
//
// Kontrak ADR-018 (status: accepted): baseline no-chain untuk produksi; provider
// publik TIDAK dipilih sekarang. Shell ini menetapkan JALUR integrasi (interface
// client yang swappable + adapter domain) sehingga tinggal "mengisi" klien jaringan
// saat keputusan manusia tiba — tanpa mengarang kredensial/transaksi.
//
// Ke-inert-an dijamin di dua lapis:
//   1. `InertAlgorandClient` tidak pernah menyentuh jaringan (melempar
//      ERR_PROVIDER_NOT_CHOSEN) — dipakai bila env `BLOCKCHAIN_ALGORAND_*` kosong.
//   2. `getChainAdapter()` (lib/chain.ts) mengembalikan `NoopChainAdapter` ketika
//      klien masih inert → action memetakan ke `BLOCKCHAIN_PROVIDER_PENDING` dan
//      TIDAK anchor apa pun.
// Pengujian memakai fake client (tanpa jaringan) untuk membuktikan logika adapter.

import type { ChainAdapter, ChainAnchorResult, ChainAnchorStatus } from "./chain";

export const ERR_PROVIDER_NOT_CHOSEN = "ALGORAND_PROVIDER_NOT_CHOSEN";

/** Client Algorand SWAPPABLE — satu-satunya titik integrasi jaringan.
 * Memisahkan domain LMS dari detail jaringan: adapter domain tidak peduli apakah
 * klien memakai SDK Algorand, HTTP JSON-RPC, indexer, atau mock — tinggal ganti
 * implementasi tanpa menyentuh logika anchor/verify. */
export interface AlgorandHttpClient {
  /** Submit root SHA-256 (32 byte; muat di memo transaksi) → reference transaksi. */
  submitAnchor(root: string): Promise<{ reference: string }>;
  /** Status anchor utk `reference`; root tersimpan dikembalikan utk verifikasi
   * (status TIDAK pernah `not_configured` — itu domain adapter). */
  fetchAnchor(
    reference: string,
  ): Promise<{ status: Exclude<ChainAnchorStatus, "not_configured">; root: string | null }>;
}

/** Client INERT: dipakai ketika provider belum dipilih (env `BLOCKCHAIN_ALGORAND_*`
 * kosong). Tidak pernah mengirim jaringan; melempar sehingga anchor tidak terjadi. */
export class InertAlgorandClient implements AlgorandHttpClient {
  async submitAnchor(_root: string): Promise<{ reference: string }> {
    throw new Error(ERR_PROVIDER_NOT_CHOSEN);
  }
  async fetchAnchor(_reference: string): Promise<{ status: "final"; root: string | null }> {
    throw new Error(ERR_PROVIDER_NOT_CHOSEN);
  }
}

/** Client HTTP PROVISIONAL — kerangka integrasi yang akan diisi saat provider
 * nyata dipilih. Bentuk endpoint/skema body BELUM final (perlu konfirmasi provider
 * + e2e chain tests sebelum dipakai production); disediakan agar shell lengkap.
 * Tidak pernah dipakai oleh `getChainAdapter()` tanpa env RPC+key yang terisi. */
export class HttpAlgorandClient implements AlgorandHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 10_000,
  ) {}

  private async post(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`ALGORAND_HTTP_${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async submitAnchor(root: string): Promise<{ reference: string }> {
    const data = (await this.post("/submit-anchor", { root })) as { reference?: string };
    if (!data?.reference) throw new Error("ALGORAND_EMPTY_REFERENCE");
    return { reference: data.reference };
  }

  async fetchAnchor(
    reference: string,
  ): Promise<{ status: Exclude<ChainAnchorStatus, "not_configured">; root: string | null }> {
    const data = (await this.post(`/anchor/${encodeURIComponent(reference)}`, {})) as {
      status?: string;
      root?: string | null;
    };
    const status = data?.status;
    if (status !== "pending" && status !== "final" && status !== "failed") {
      throw new Error("ALGORAND_BAD_STATUS");
    }
    return { status, root: data?.root ?? null };
  }
}

export interface MockAlgorandClientOptions {
  /** Jumlah poll getStatus sebelum final; default 1 (deterministik). */
  confirmations?: number;
  /** Store bersama antar-instance (default: module-level — mock "chain" dibagikan
   *  proses seperti jaringan sungguhan; inject utk isolasi di tests). */
  store?: Map<string, { root: string; confirmations: number }>;
}

const mockAlgorandStore = new Map<string, { root: string; confirmations: number }>();

/** Reset store mock — HANYA utk tests/isolasi. */
export function __resetMockAlgorandStore(): void {
  mockAlgorandStore.clear();
}

/**
 * Mock client Algorand (mode `BLOCKCHAIN_PROVIDER=algorand-mock`) — TANPA jaringan,
 * finality deterministik + IRREVERSIBEL (meniru Algorand):
 *   submit → pending (reference deterministik dari root, idempoten) →
 *   poll getStatus × confirmations → final; final tidak pernah kembali ke pending.
 * Store dibagikan antar-instance dalam satu proses (dev/preview/tests) sehingga
 * getStatus lintas request berfungsi — persis seperti jaringan nyata yang dibagikan.
 */
export class MockAlgorandClient implements AlgorandHttpClient {
  private readonly confirmations: number;
  private readonly store: Map<string, { root: string; confirmations: number }>;

  constructor(options: MockAlgorandClientOptions = {}) {
    this.confirmations = options.confirmations ?? 1;
    this.store = options.store ?? mockAlgorandStore;
  }

  async submitAnchor(root: string): Promise<{ reference: string }> {
    // Idempoten: root yang sama → reference yang sama (seperti retry aman).
    for (const [reference, rec] of this.store) {
      if (rec.root === root) return { reference };
    }
    const reference = `algo-mock-${root.slice(0, 12)}`;
    this.store.set(reference, { root, confirmations: 0 });
    return { reference };
  }

  async fetchAnchor(
    reference: string,
  ): Promise<{ status: Exclude<ChainAnchorStatus, "not_configured">; root: string | null }> {
    const rec = this.store.get(reference);
    if (!rec) return { status: "failed", root: null };
    rec.confirmations += 1;
    const status = rec.confirmations >= this.confirmations ? "final" : "pending";
    return { status, root: rec.root };
  }
}

/** Adapter domain yang memetakan `AlgorandHttpClient` ke antarmuka `ChainAdapter`.
 * Murni terhadap jaringan — semua I/O lewat client yang di-inject. */
export class HttpChainAdapter implements ChainAdapter {
  /** Network target (mis. mainnet/testnet) — metadata utk pelaporan/audit. */
  readonly network: string;

  constructor(
    private readonly client: AlgorandHttpClient,
    network: string,
  ) {
    this.network = network;
  }

  async anchor(rootHash: string): Promise<ChainAnchorResult> {
    try {
      const { reference } = await this.client.submitAnchor(rootHash);
      return { status: "pending", reference };
    } catch (e) {
      if (e instanceof Error && e.message === ERR_PROVIDER_NOT_CHOSEN) {
        // Inert (belum ada provider) — TIDAK mengarang transaksi.
        return { status: "not_configured", reference: null };
      }
      return { status: "failed", reference: null };
    }
  }

  async getStatus(reference: string): Promise<ChainAnchorResult> {
    try {
      const a = await this.client.fetchAnchor(reference);
      return { status: a.status, reference };
    } catch {
      // Provider tidak tersedia / error → failed, bukan klaim "invalid" palsu.
      return { status: "failed", reference };
    }
  }

  async verify(rootHash: string, reference: string): Promise<boolean> {
    try {
      const a = await this.client.fetchAnchor(reference);
      return a.status === "final" && a.root === rootHash;
    } catch {
      return false;
    }
  }
}

/** Seleksi client dari env. Kosong → `InertAlgorandClient` (provider belum dipilih). */
export function getAlgorandClient(): AlgorandHttpClient {
  const rpc = (process.env.BLOCKCHAIN_ALGORAND_RPC_URL ?? "").trim();
  const key = (process.env.BLOCKCHAIN_ALGORAND_API_KEY ?? "").trim();
  if (!rpc || !key) return new InertAlgorandClient();
  return new HttpAlgorandClient(rpc, key);
}
