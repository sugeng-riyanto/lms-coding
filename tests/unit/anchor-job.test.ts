import { describe, expect, it } from "vitest";
import {
  ANCHOR_BATCH_LIMIT,
  collectAnchorCandidates,
  isAnchorEligible,
  runAnchorBatch,
  type AnchorBatchDeps,
  type AnchorCandidate,
  type ExistingAnchor,
} from "@/lib/anchor-job";
import { merkleRoot } from "@/lib/merkle";
import { MockChainAdapter } from "@/lib/chain";

const H1 = "h".padEnd(64, "1");
const H2 = "h".padEnd(64, "2");
const H3 = "h".padEnd(64, "3");

function cert(id: string, payloadHash: string, over: Partial<{ status: string; anchored: boolean }> = {}) {
  return {
    id,
    status: over.status ?? "active",
    chain_anchor_id: over.anchored ? "anchor-x" : null,
    payload_hash: over.status === "revoked" ? null : payloadHash,
  };
}

function memoryDeps(overrides: Partial<AnchorBatchDeps> = {}) {
  const anchors = new Map<string, { id: string; root: string; status: string; reference: string | null }>();
  const links: { anchorId: string; ids: string[] }[] = [];
  const inserts: unknown[] = [];
  let seq = 0;
  const deps: AnchorBatchDeps = {
    findCandidates: async () => [],
    findAnchorByRoot: async (root): Promise<ExistingAnchor | null> => {
      for (const a of anchors.values())
        if (a.root === root) return { id: a.id, status: a.status, transaction_ref: a.reference };
      return null;
    },
    insertAnchor: async (row) => {
      const id = `anchor-${++seq}`;
      anchors.set(id, {
        id,
        root: row.merkle_root,
        status: row.status,
        reference: row.transaction_ref,
      });
      inserts.push(row);
      return id;
    },
    linkCertificates: async (anchorId, ids) => {
      links.push({ anchorId, ids });
    },
    adapter: new MockChainAdapter(),
    provider: "mock",
    network: "test-local",
    organizationId: "org-1",
    ...overrides,
  };
  return { deps, anchors, links, inserts };
}

describe("isAnchorEligible / collectAnchorCandidates", () => {
  it("hanya active + belum ter-anchor + punya payload hash", () => {
    expect(isAnchorEligible({ status: "active", chain_anchor_id: null, payload_hash: H1 })).toBe(true);
    expect(isAnchorEligible({ status: "revoked", chain_anchor_id: null, payload_hash: H1 })).toBe(false);
    expect(isAnchorEligible({ status: "active", chain_anchor_id: "a1", payload_hash: H1 })).toBe(false);
    expect(isAnchorEligible({ status: "active", chain_anchor_id: null, payload_hash: null })).toBe(false);
  });

  it("membatasi batch dan mengurutkan deterministik", () => {
    const rows = [cert("b", H2), cert("a", H1), cert("c", H3), cert("r", H3, { status: "revoked" })];
    const out = collectAnchorCandidates(rows, 2);
    expect(out.map((c) => c.certificateId)).toEqual(["a", "b"]);
    expect(collectAnchorCandidates(rows, 1).length).toBe(1);
    expect(collectAnchorCandidates(rows, 100).length).toBe(3);
  });
});

describe("runAnchorBatch — orchestrator", () => {
  const candidates = async (): Promise<AnchorCandidate[]> => [
    { certificateId: "c1", payloadHash: H1 },
    { certificateId: "c2", payloadHash: H2 },
    { certificateId: "c3", payloadHash: H3 },
  ];

  it("happy: anchor → insert baris pending (root Merkle) → link semua id", async () => {
    const { deps, inserts, links, anchors } = memoryDeps({ findCandidates: candidates });
    const out = await runAnchorBatch(deps);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.anchored).toBe(3);
    expect(out.root).toBe(merkleRoot([H1, H2, H3]));
    expect(out.reference).toMatch(/^mock-anchor-/);
    expect(out.status).toBe("pending");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      provider: "mock",
      network: "test-local",
      organization_id: "org-1",
      merkle_root: merkleRoot([H1, H2, H3]),
      status: "pending",
    });
    expect(links).toEqual([{ anchorId: "anchor-1", ids: ["c1", "c2", "c3"] }]);
    // Baris tersimpan di store dengan reference hasil adapter.
    expect([...anchors.values()][0]?.reference).toBe(out.reference);
  });

  it("tanpa kandidat → no_candidates, adapter TIDAK dipanggil, tanpa insert", async () => {
    const adapter = new MockChainAdapter();
    const spy = { called: 0 };
    const orig = adapter.anchor.bind(adapter);
    adapter.anchor = async (r) => {
      spy.called += 1;
      return orig(r);
    };
    const { deps, inserts, links } = memoryDeps({ adapter });
    const out = await runAnchorBatch(deps);
    expect(out).toEqual({ ok: false, reason: "no_candidates", root: null });
    expect(spy.called).toBe(0);
    expect(inserts).toHaveLength(0);
    expect(links).toHaveLength(0);
  });

  it("anchor gagal permanen → anchor_failed, tanpa insert/link (retry run berikutnya)", async () => {
    const { deps, inserts, links } = memoryDeps({
      findCandidates: candidates,
      adapter: new MockChainAdapter({ failAnchor: true }),
    });
    const out = await runAnchorBatch(deps);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("anchor_failed");
    expect(out.root).toBe(merkleRoot([H1, H2, H3]));
    expect(inserts).toHaveLength(0);
    expect(links).toHaveLength(0);
  });

  it("crash-window: root sama sudah ada → link ke anchor lama, TANPA anchor ulang", async () => {
    const adapter = new MockChainAdapter();
    const spy = { called: 0 };
    const orig = adapter.anchor.bind(adapter);
    adapter.anchor = async (r) => {
      spy.called += 1;
      return orig(r);
    };
    // Simulasi run pertama sukses menyimpan root tapi link gagal (crash).
    const { deps, anchors, inserts, links } = memoryDeps({ findCandidates: candidates, adapter });
    const first = await runAnchorBatch(deps);
    if (!first.ok || !first.root) throw new Error("run pertama gagal");
    anchors.set("anchor-1", {
      id: "anchor-1",
      root: first.root,
      status: "pending",
      reference: "mock-anchor-same",
    });
    inserts.length = 0; // reset jejak run pertama
    links.length = 0;
    // Run kedua: kandidat SAMA (masih belum ter-link) → dedup ke baris ada.
    const out = await runAnchorBatch(deps);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.anchored).toBe(3);
    expect(out.reference).toBe("mock-anchor-same");
    expect(spy.called).toBe(1); // anchor hanya dipanggil SEKALI total
    expect(inserts).toHaveLength(0); // tidak insert baris baru
    expect(links).toEqual([{ anchorId: "anchor-1", ids: ["c1", "c2", "c3"] }]);
  });

  it("menghormati ANCHOR_BATCH_LIMIT dari findCandidates", async () => {
    const many = async (): Promise<AnchorCandidate[]> =>
      Array.from({ length: ANCHOR_BATCH_LIMIT + 50 }, (_, i) => ({
        certificateId: `c${i}`,
        payloadHash: H1,
      }));
    const { deps } = memoryDeps({ findCandidates: many });
    const out = await runAnchorBatch(deps);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.anchored).toBe(ANCHOR_BATCH_LIMIT);
  });
});
