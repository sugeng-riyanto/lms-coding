import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * scripts/check-env.mjs — self-check struktural .env (predev/prebuild/prestart):
 * duplikat key (last-wins), key asing (paste dashboard), dan baris garbage
 * (paste tutorial) harus menggagalkan startup dengan pesan terbaca.
 */
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "check-env.mjs");

const EXAMPLE = [
  "NEXT_PUBLIC_APP_URL=http://localhost:3000",
  "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x",
  "SUPABASE_SECRET_KEY=sb_secret_x",
  "CERTIFICATE_SIGNING_SECRET=0123456789abcdef0123456789abcdef",
  "ROBLOX_WEBHOOK_SECRET=",
  "BLOCKCHAIN_ANCHOR_ENABLED=false",
  "BLOCKCHAIN_PROVIDER=",
  "BLOCKCHAIN_NETWORK=",
].join("\n");

const dirs: string[] = [];
function makeDir(): string {
  const d = mkdtempSync(join(tmpdir(), "envcheck-"));
  dirs.push(d);
  return d;
}
function runIn(dir: string) {
  return spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });
}
function out(r: { stdout: string; stderr: string }) {
  return `${r.stdout}\n${r.stderr}`;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("check-env structural guard", () => {
  it("file bersih lolos (exit 0)", () => {
    const d = makeDir();
    writeFileSync(join(d, ".env.example"), EXAMPLE);
    writeFileSync(join(d, ".env"), EXAMPLE);
    const r = runIn(d);
    expect(r.status).toBe(0);
    expect(out(r)).toMatch(/check-env OK/);
  });

  it("key duplikat menggagalkan start dengan pesan last-wins", () => {
    const d = makeDir();
    writeFileSync(join(d, ".env.example"), EXAMPLE);
    writeFileSync(join(d, ".env"), `${EXAMPLE}\nNEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\n`);
    const r = runIn(d);
    expect(r.status).toBe(1);
    expect(out(r)).toMatch(/duplikat 'NEXT_PUBLIC_SUPABASE_URL'/);
    expect(out(r)).toMatch(/last-wins/);
    expect(out(r)).toMatch(/ENV FILE CHECK FAILED/);
  });

  it("key asing dari paste dashboard (SUPABASE_URL, host) menggagalkan start", () => {
    const d = makeDir();
    writeFileSync(join(d, ".env.example"), EXAMPLE);
    writeFileSync(
      join(d, ".env"),
      `${EXAMPLE}\nSUPABASE_URL=https://x.supabase.co\nhost=aws-0.example.pooler.supabase.com\n`,
    );
    const r = runIn(d);
    expect(r.status).toBe(1);
    const text = out(r);
    expect(text).toMatch(/key tak dikenal 'SUPABASE_URL'/);
    expect(text).toMatch(/key tak dikenal 'host'/);
    expect(text).toMatch(/bukan SUPABASE_URL/);
  });

  it("baris garbage (prosa tutorial) menggagalkan start", () => {
    const d = makeDir();
    writeFileSync(join(d, ".env.example"), EXAMPLE);
    writeFileSync(join(d, ".env"), `${EXAMPLE}\n1. Install packages\nnpm install @supabase/ssr\n`);
    const r = runIn(d);
    expect(r.status).toBe(1);
    expect(out(r)).toMatch(/baris bukan KEY=value/);
    expect(out(r)).toMatch(/Install packages/);
  });

  it("file env tidak ada (CI, env dari runner) → dilewati, exit 0", () => {
    const d = makeDir();
    writeFileSync(join(d, ".env.example"), EXAMPLE);
    const r = runIn(d);
    expect(r.status).toBe(0);
    expect(out(r)).toMatch(/dilewati/);
  });

  it(".env.example hilang → error eksplisit", () => {
    const d = makeDir();
    writeFileSync(join(d, ".env"), EXAMPLE);
    const r = runIn(d);
    expect(r.status).toBe(1);
    expect(out(r)).toMatch(/\.env\.example tidak ditemukan/);
  });

  it("nilai boleh mengandung '=' dan '#' (bukan garbage)", () => {
    const d = makeDir();
    writeFileSync(join(d, ".env.example"), EXAMPLE);
    writeFileSync(join(d, ".env"), `${EXAMPLE}\nSUPABASE_SECRET_KEY=eyJhbGciOi#hash=abc\n`);
    const r = runIn(d);
    expect(r.status).toBe(1); // SUPABASE_SECRET_KEY duplikat — tapi bukan karena garbage
    expect(out(r)).not.toMatch(/baris bukan KEY=value/);
    expect(out(r)).toMatch(/duplikat 'SUPABASE_SECRET_KEY'/);
  });
});
