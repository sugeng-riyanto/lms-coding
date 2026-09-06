import { afterEach, describe, expect, it } from "vitest";
import {
  MockChainAdapter,
  NoopChainAdapter,
  anchorWithRetry,
  getChainAdapter,
  isChainEnabled,
  verifyAnchor,
} from "@/lib/chain";

afterEach(() => {
  delete process.env.BLOCKCHAIN_ANCHOR_ENABLED;
  delete process.env.BLOCKCHAIN_PROVIDER;
});

describe("MockChainAdapter — lifecycle anchor", () => {
  it("anchor → pending; getStatus (confirmations=1) → final; verify → true", async () => {
    const a = new MockChainAdapter();
    const r = await a.anchor("root-abc");
    expect(r.status).toBe("pending");
    expect(r.reference).toMatch(/^mock-anchor-/);
    expect((await a.getStatus(r.reference as string)).status).toBe("final");
    expect(await a.verify("root-abc", r.reference as string)).toBe(true);
  });

  it("duplicate anchoring: root sama → reference sama (idempoten)", async () => {
    const a = new MockChainAdapter();
    const r1 = await a.anchor("dup-root");
    const r2 = await a.anchor("dup-root");
    expect(r2.reference).toBe(r1.reference);
  });

  it("confirmations=Infinity → pending selamanya; verify false sebelum final", async () => {
    const a = new MockChainAdapter({ confirmations: Infinity });
    const r = await a.anchor("root-p");
    expect(r.status).toBe("pending");
    expect((await a.getStatus(r.reference as string)).status).toBe("pending");
    expect(await a.verify("root-p", r.reference as string)).toBe(false);
  });

  it("anchor gagal permanen → status failed", async () => {
    const a = new MockChainAdapter({ failAnchor: true });
    expect((await a.anchor("root-f")).status).toBe("failed");
  });

  it("provider timeout: anchor menolak setelah timeoutMs", async () => {
    const a = new MockChainAdapter({ timeoutMs: 5 });
    await expect(a.anchor("root-t")).rejects.toThrow("PROVIDER_TIMEOUT");
  });

  it("retry: gagal sekali (transient) lalu sukses via anchorWithRetry", async () => {
    const a = new MockChainAdapter({ failAnchorOnce: true });
    const r = await anchorWithRetry(a, "root-r", { attempts: 3, baseDelayMs: 0 });
    expect(r.status).toBe("pending");
    expect(r.reference).toMatch(/^mock-anchor-/);
  });

  it("retry habis: anchor selalu timeout → failed setelah attempts", async () => {
    const a = new MockChainAdapter({ timeoutMs: 5 });
    const r = await anchorWithRetry(a, "root-x", { attempts: 2, baseDelayMs: 0 });
    expect(r.status).toBe("failed");
  });

  it("provider unavailable: getStatus/verify lempar", async () => {
    const a = new MockChainAdapter({ unavailable: true });
    await expect(a.getStatus("ref")).rejects.toThrow("PROVIDER_UNAVAILABLE");
    await expect(a.verify("r", "ref")).rejects.toThrow("PROVIDER_UNAVAILABLE");
  });
});

describe("verifyAnchor — fallback verification", () => {
  it("final → verified; root salah → invalid", async () => {
    const a = new MockChainAdapter();
    const r = await a.anchor("rootX");
    await a.getStatus(r.reference as string); // → final
    expect(await verifyAnchor(a, "rootX", r.reference as string)).toBe("verified");
    expect(await verifyAnchor(a, "rootY", r.reference as string)).toBe("invalid");
  });

  it("pending → not_final (bukan invalid/verified)", async () => {
    const a = new MockChainAdapter({ confirmations: Infinity });
    const r = await a.anchor("rootP");
    expect(await verifyAnchor(a, "rootP", r.reference as string)).toBe("not_final");
  });

  it("provider unavailable → unavailable (fallback, bukan klaim palsu)", async () => {
    const a = new MockChainAdapter({ unavailable: true });
    expect(await verifyAnchor(a, "root", "ref")).toBe("unavailable");
  });
});

describe("seleksi adapter & flag (ADR-018)", () => {
  it("flag off → noop; enabled+mock → mock; enabled+provider nyata → noop (keputusan manusia pending)", () => {
    process.env.BLOCKCHAIN_ANCHOR_ENABLED = "false";
    expect(isChainEnabled()).toBe(false);
    expect(getChainAdapter()).toBeInstanceOf(NoopChainAdapter);

    process.env.BLOCKCHAIN_ANCHOR_ENABLED = "true";
    process.env.BLOCKCHAIN_PROVIDER = "mock";
    expect(isChainEnabled()).toBe(true);
    expect(getChainAdapter()).toBeInstanceOf(MockChainAdapter);

    // Provider nyata BELUM dipilih → tolak, jangan mengarang kredensial/transaksi.
    process.env.BLOCKCHAIN_PROVIDER = "ethereum";
    expect(getChainAdapter()).toBeInstanceOf(NoopChainAdapter);
    process.env.BLOCKCHAIN_PROVIDER = "solana";
    expect(getChainAdapter()).toBeInstanceOf(NoopChainAdapter);
  });

  it("NoopChainAdapter: tidak ada klaim chain", async () => {
    const n = new NoopChainAdapter();
    expect((await n.anchor("abc")).status).toBe("not_configured");
    expect((await n.getStatus("ref")).status).toBe("not_configured");
    expect(await n.verify("abc", "ref")).toBe(false);
  });
});
