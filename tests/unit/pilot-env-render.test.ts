import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const render = resolve(root, "scripts/pilot-env-render.mjs");

function run(inputs: Record<string, string>): string {
  return execFileSync(process.execPath, [render], {
    env: { ...process.env, ...inputs },
    encoding: "utf8",
  });
}

describe("scripts/pilot-env-render.mjs", () => {
  const base = {
    PILOT_REF: "abcdefghijklmnopqrst",
    PILOT_DOMAIN: "pilot.example.org",
    PILOT_PUBLISHABLE: "sb_publishable_test",
    PILOT_SERVICE_ROLE: "eyJtest",
    CERT_SIGNING_SECRET: "0123456789abcdef0123456789abcdef",
  };

  it("renders all required keys with resolved placeholders", () => {
    const out = run(base);
    expect(out).toContain("NEXT_PUBLIC_APP_URL=https://pilot.example.org");
    expect(out).toContain("NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co");
    expect(out).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test");
    expect(out).toContain("SUPABASE_SECRET_KEY=eyJtest");
    expect(out).toContain("CERTIFICATE_SIGNING_SECRET=0123456789abcdef0123456789abcdef");
  });

  it("defaults every feature flag to the production posture (all OFF/empty)", () => {
    const out = run(base);
    expect(out).toMatch(/^BLOCKCHAIN_ANCHOR_ENABLED=false$/m);
    expect(out).toMatch(/^BLOCKCHAIN_PROVIDER=$/m);
    expect(out).toMatch(/^AI_FEEDBACK_ENABLED=false$/m);
    expect(out).toMatch(/^CODE_RUNNER_ENABLED=false$/m);
    expect(out).toMatch(/^ROBLOX_WEBHOOK_SECRET=$/m);
    expect(out).toMatch(/^CSP_REPORT_ONLY=true$/m);
  });

  it("keeps the service role server-only (no NEXT_PUBLIC_ prefix leak)", () => {
    const out = run(base);
    expect(out).toContain("SUPABASE_SECRET_KEY=");
    expect(out).not.toMatch(/^NEXT_PUBLIC_.*SECRET/m);
  });

  it("exits non-zero when required inputs are missing", () => {
    expect(() => run({})).toThrow();
    expect(() => run({ ...base, PILOT_REF: "" })).toThrow();
  });

  it("never contains placeholder tokens like <pilot-ref>", () => {
    const out = run(base);
    expect(out).not.toMatch(/<[a-z-]+>/);
    expect(out).not.toContain("your-domain");
  });
});
