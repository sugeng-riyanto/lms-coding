import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260906000018_anchor_batch_org.sql", "utf8");
const lib = readFileSync("lib/anchor-job.ts", "utf8");
const actions = readFileSync("features/actions.ts", "utf8");

describe("migration 000018 — chain_anchors scoped per-org", () => {
  it("organization_id nullable + index", () => {
    expect(migration).toMatch(/add column organization_id uuid references public\.organizations\(id\)/);
    expect(migration).toMatch(
      /create index chain_anchors_org_idx on public\.chain_anchors \(organization_id\)/,
    );
  });
});

describe("lib/anchor-job — surface murni + orkestrasi", () => {
  it("mengekspor seleksi, limit, dan runAnchorBatch", () => {
    expect(lib).toMatch(/export const ANCHOR_BATCH_LIMIT = 200/);
    expect(lib).toMatch(/export function isAnchorEligible/);
    expect(lib).toMatch(/export function collectAnchorCandidates/);
    expect(lib).toMatch(/export async function runAnchorBatch/);
    expect(lib).toMatch(/merkleRoot\(/);
  });

  it("orkestrasi via deps (tanpa DB langsung); anchor lewat adapter; dedup crash-window", () => {
    expect(lib).toMatch(/findAnchorByRoot/);
    expect(lib).toMatch(/deps\.adapter\.anchor\(root\)/);
    expect(lib).toMatch(/insertAnchor\(/);
    expect(lib).toMatch(/linkCertificates\(/);
    // Hanya hash/root + tx reference yang disimpan — komentar eksplisit tanpa PII.
    expect(lib).toMatch(/tanpa PII\/nilai/);
  });
});

describe("anchorCertificateBatch action — authz + gerbang ADR-018", () => {
  it("ada di features/actions + memakai runAnchorBatch & service client", () => {
    expect(actions).toMatch(/export async function anchorCertificateBatch/);
    expect(actions).toMatch(/from "@\/lib\/anchor-job"/);
    expect(actions).toMatch(/runAnchorBatch\(\{/);
    expect(actions).toMatch(/createServiceClient\(\)/);
  });

  it("validasi caller guru teacher aktif org SEBELUM jalur service", () => {
    const fn = actions.slice(actions.indexOf("export async function anchorCertificateBatch"));
    const mem = fn.indexOf('.from("memberships")');
    const svc = fn.indexOf("createServiceClient()");
    const batch = fn.indexOf("runAnchorBatch");
    expect(mem).toBeGreaterThan(-1);
    expect(svc).toBeGreaterThan(mem);
    expect(batch).toBeGreaterThan(svc);
    expect(fn).toMatch(/role\", \"teacher\"/);
    expect(fn).toMatch(/status\", \"active\"/);
  });

  it("gerbang fail-closed ADR-018 + scope org tanpa cross-org leak", () => {
    const fn = actions.slice(actions.indexOf("export async function anchorCertificateBatch"));
    expect(fn).toMatch(/BLOCKCHAIN_DISABLED/);
    expect(fn).toMatch(/BLOCKCHAIN_PROVIDER_PENDING/);
    expect(fn).toMatch(/getChainAdapter\(\)/);
    expect(fn).toMatch(/instanceof NoopChainAdapter/);
    // Batch HANYA sertifikat active + belum ter-anchor + org caller (filter nested).
    expect(fn).toMatch(/\.eq\("status", "active"\)/);
    expect(fn).toMatch(/\.is\("chain_anchor_id", null\)/);
    expect(fn).toMatch(/enrollments\.courses\.organization_id/);
  });
});
