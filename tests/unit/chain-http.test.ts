import { afterEach, describe, expect, it } from "vitest";
import {
  ERR_PROVIDER_NOT_CHOSEN,
  HttpAlgorandClient,
  HttpChainAdapter,
  InertAlgorandClient,
  MockAlgorandClient,
  __resetMockAlgorandStore,
  type AlgorandHttpClient,
} from "@/lib/chain-http";
import { getChainAdapter, NoopChainAdapter } from "@/lib/chain";

/** Fake client deterministik — TANPA jaringan. */
function fakeClient(overrides: Partial<AlgorandHttpClient> = {}): AlgorandHttpClient & {
  submittedRoots: string[];
} {
  const submittedRoots: string[] = [];
  return {
    submittedRoots,
    async submitAnchor(root) {
      submittedRoots.push(root);
      return { reference: `algo-${root.slice(0, 8)}` };
    },
    async fetchAnchor(reference) {
      return { status: "final", root: reference.replace(/^algo-/, "").padEnd(64, "0") };
    },
    ...overrides,
  };
}

async function withEnv(env: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) prev[k] = process.env[k];
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const k of Object.keys(env)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

afterEach(() => {
  delete process.env.BLOCKCHAIN_ANCHOR_ENABLED;
  delete process.env.BLOCKCHAIN_PROVIDER;
  delete process.env.BLOCKCHAIN_NETWORK;
  delete process.env.BLOCKCHAIN_ALGORAND_RPC_URL;
  delete process.env.BLOCKCHAIN_ALGORAND_API_KEY;
  __resetMockAlgorandStore();
});

describe("HttpChainAdapter (shell Algorand, ADR-018)", () => {
  it("anchor → pending + reference dari client; root diteruskan ke client", async () => {
    const client = fakeClient();
    const adapter = new HttpChainAdapter(client, "testnet");
    const root = "ab".repeat(32);
    const r = await adapter.anchor(root);
    expect(r.status).toBe("pending");
    expect(r.reference).toBe(`algo-${root.slice(0, 8)}`);
    expect(client.submittedRoots).toEqual([root]);
  });

  it("getStatus → memetakan status client (final/pending/failed)", async () => {
    const adapter = new HttpChainAdapter(
      fakeClient({
        fetchAnchor: async (ref) => ({ status: ref.includes("pending") ? "pending" : "final", root: null }),
      }),
      "testnet",
    );
    expect((await adapter.getStatus("x-pending")).status).toBe("pending");
    expect((await adapter.getStatus("x-final")).status).toBe("final");
  });

  it("verify → true HANYA saat final DAN root cocok; false saat pending/mismatch", async () => {
    const adapter = new HttpChainAdapter(
      fakeClient({
        fetchAnchor: async (ref) =>
          ref.includes("final")
            ? { status: "final" as const, root: "abcdef".padEnd(64, "0") }
            : { status: "pending" as const, root: "abcdef".padEnd(64, "0") },
      }),
      "testnet",
    );
    const root = "abcdef".padEnd(64, "0");
    expect(await adapter.verify(root, "a-final")).toBe(true);
    expect(await adapter.verify(root, "a-pending")).toBe(false);
    expect(await adapter.verify("ffff".padEnd(64, "0"), "a-final")).toBe(false);
  });

  it("client inert → anchor not_configured (TIDAK mengarang transaksi); getStatus failed", async () => {
    const adapter = new HttpChainAdapter(new InertAlgorandClient(), "testnet");
    const r = await adapter.anchor("ab".repeat(32));
    expect(r.status).toBe("not_configured");
    expect(r.reference).toBeNull();
    expect((await adapter.getStatus("any")).status).toBe("failed");
    expect(await adapter.verify("ab".repeat(32), "any")).toBe(false);
  });

  it("swappable: dua client berbeda menghasilkan reference berbeda, logika adapter sama", async () => {
    const a = new HttpChainAdapter(fakeClient(), "a");
    const b = new HttpChainAdapter(fakeClient(), "b");
    const root = "cd".repeat(32);
    expect((await a.anchor(root)).reference).toBe(`algo-${root.slice(0, 8)}`);
    expect((await b.anchor(root)).reference).toBe(`algo-${root.slice(0, 8)}`);
    // berbeda client bisa beda reference — buktikan interface swappable via override
    const c = new HttpChainAdapter(
      fakeClient({ submitAnchor: async () => ({ reference: "ref-custom-123" }) }),
      "c",
    );
    expect((await c.anchor(root)).reference).toBe("ref-custom-123");
  });
});

describe("getChainAdapter — gating inert (ADR-018)", () => {
  it("provider=algorand TANPA env Algorand → Noop (inert, bukan transaksi)", async () => {
    await withEnv({ BLOCKCHAIN_ANCHOR_ENABLED: "true", BLOCKCHAIN_PROVIDER: "algorand" }, () => {
      expect(getChainAdapter()).toBeInstanceOf(NoopChainAdapter);
    });
  });

  it("provider=algorand DENGAN RPC+key → HttpChainAdapter (shell aktif)", async () => {
    await withEnv(
      {
        BLOCKCHAIN_ANCHOR_ENABLED: "true",
        BLOCKCHAIN_PROVIDER: "algorand",
        BLOCKCHAIN_ALGORAND_RPC_URL: "https://rpc.example.test",
        BLOCKCHAIN_ALGORAND_API_KEY: "secret",
      },
      () => {
        const a = getChainAdapter();
        expect(a).toBeInstanceOf(HttpChainAdapter);
      },
    );
  });

  it("flag off / provider tak dikenal → Noop selalu", async () => {
    await withEnv({ BLOCKCHAIN_ANCHOR_ENABLED: "false", BLOCKCHAIN_PROVIDER: "algorand" }, () => {
      expect(getChainAdapter()).toBeInstanceOf(NoopChainAdapter);
    });
    await withEnv({ BLOCKCHAIN_ANCHOR_ENABLED: "true", BLOCKCHAIN_PROVIDER: "bogus" }, () => {
      expect(getChainAdapter()).toBeInstanceOf(NoopChainAdapter);
    });
  });
});

describe("MockAlgorandClient — finality deterministik (algorand-mock)", () => {
  it("submit → pending; satu poll → final; reference deterministik dari root", async () => {
    const adapter = new HttpChainAdapter(new MockAlgorandClient(), "testnet");
    const root = "ab".repeat(32);
    const anchored = await adapter.anchor(root);
    expect(anchored.status).toBe("pending");
    expect(anchored.reference).toBe(`algo-mock-${root.slice(0, 12)}`);
    expect((await adapter.getStatus(anchored.reference!)).status).toBe("final");
  });

  it("duplicate root → reference SAMA (idempoten); tidak ada anchor ganda", async () => {
    const client = new MockAlgorandClient();
    const root = "cd".repeat(32);
    const a = await client.submitAnchor(root);
    const b = await client.submitAnchor(root);
    expect(a.reference).toBe(b.reference);
  });

  it("confirmations=2 → dua poll sebelum final; final IRREVERSIBEL", async () => {
    const client = new MockAlgorandClient({ confirmations: 2 });
    const { reference } = await client.submitAnchor("ef".repeat(32));
    expect((await client.fetchAnchor(reference)).status).toBe("pending");
    expect((await client.fetchAnchor(reference)).status).toBe("final");
    // final tidak pernah kembali ke pending (meniru finality irreversibel Algorand)
    expect((await client.fetchAnchor(reference)).status).toBe("final");
    expect((await client.fetchAnchor(reference)).status).toBe("final");
  });

  it("reference tak dikenal → failed (bukan klaim final palsu)", async () => {
    const client = new MockAlgorandClient();
    expect((await client.fetchAnchor("nope")).status).toBe("failed");
  });

  it("store ter-inject utk isolasi; __resetMockAlgorandStore membersihkan store global", async () => {
    const store = new Map();
    const c1 = new MockAlgorandClient({ store });
    const root = "12".repeat(32);
    const { reference } = await c1.submitAnchor(root);
    expect((await c1.fetchAnchor(reference)).status).toBe("final");
    // instance lain dengan store sama melihat state yang sama (mock "chain" dibagikan)
    const c2 = new MockAlgorandClient({ store });
    expect((await c2.fetchAnchor(reference)).root).toBe(root);
  });

  it("getChainAdapter provider=algorand-mock → HttpChainAdapter; alur pending→final via getStatus", async () => {
    withEnv({ BLOCKCHAIN_ANCHOR_ENABLED: "true", BLOCKCHAIN_PROVIDER: "algorand-mock" }, async () => {
      const adapter = getChainAdapter();
      expect(adapter).toBeInstanceOf(HttpChainAdapter);
      const root = "aa".repeat(32);
      const anchored = await adapter.anchor(root);
      expect(anchored.status).toBe("pending");
      expect((await adapter.getStatus(anchored.reference!)).status).toBe("final");
      expect(await adapter.verify(root, anchored.reference!)).toBe(true);
    });
  });
});

describe("HttpAlgorandClient (provisional HTTP shell)", () => {
  it("submitAnchor → POST /submit-anchor, Bearer key, ambil reference", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ reference: "algo-tx-1" }), { status: 200 });
    }) as typeof fetch;
    try {
      const client = new HttpAlgorandClient("https://rpc.example", "sekret");
      const r = await client.submitAnchor("ab".repeat(32));
      expect(r.reference).toBe("algo-tx-1");
      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call.url).toBe("https://rpc.example/submit-anchor");
      expect((call.init.headers as Record<string, string>).authorization).toBe("Bearer sekret");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("fetchAnchor → memetakan status; status tak dikenal → throw", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "final", root: "ab".repeat(32) }), {
        status: 200,
      })) as typeof fetch;
    try {
      const client = new HttpAlgorandClient("https://rpc.example", "sekret");
      expect((await client.fetchAnchor("ref-1")).status).toBe("final");
    } finally {
      globalThis.fetch = origFetch;
    }
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "wat" }), { status: 200 })) as typeof fetch;
    try {
      const client = new HttpAlgorandClient("https://rpc.example", "sekret");
      await expect(client.fetchAnchor("ref-2")).rejects.toThrow("ALGORAND_BAD_STATUS");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("InertAlgorandClient melempar ERR_PROVIDER_NOT_CHOSEN", async () => {
    const inert = new InertAlgorandClient();
    await expect(inert.submitAnchor("ab".repeat(32))).rejects.toThrow(ERR_PROVIDER_NOT_CHOSEN);
    await expect(inert.fetchAnchor("x")).rejects.toThrow(ERR_PROVIDER_NOT_CHOSEN);
  });
});
