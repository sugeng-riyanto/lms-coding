import { describe, expect, it } from "vitest";
import { buildCspPolicy, cspHeaderName, CSP_REPORT_ENDPOINT } from "@/lib/csp";

describe("buildCspPolicy", () => {
  it("memakai nonce + strict-dynamic tanpa unsafe-inline/unsafe-eval di produksi", () => {
    const policy = buildCspPolicy({ nonce: "nonce-abc123" });
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self' 'nonce-nonce-abc123' 'strict-dynamic'");
    // 'unsafe-inline' hanya diizinkan di style-src (tradeoff terdokumentasi) —
    // script-src harus bebas darinya.
    const scriptSrc = policy.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("dev menambahkan unsafe-eval (React dev) dan host Supabase lokal", () => {
    const policy = buildCspPolicy({ nonce: "n1", isDev: true });
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("http://127.0.0.1:*");
    expect(policy).toContain("ws://127.0.0.1:*");
  });

  it("produksi tidak memuat unsafe-eval atau host dev", () => {
    const policy = buildCspPolicy({ nonce: "n1" });
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("127.0.0.1");
  });

  it("frame-src per-host memuat seluruh host media-embed", () => {
    const policy = buildCspPolicy({ nonce: "n1" });
    expect(policy).toContain(
      "frame-src 'self' https://www.youtube-nocookie.com https://docs.google.com https://*.supabase.co",
    );
  });

  it("memuat pengarah hardening + media + pelaporan", () => {
    const policy = buildCspPolicy({ nonce: "n1" });
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("media-src 'self' https:");
    expect(policy).toContain(`report-uri ${CSP_REPORT_ENDPOINT}`);
    expect(policy).toContain("report-to csp-endpoint");
    // HTTPS dipaksakan di reverse proxy; header ini justru memutus dev lokal.
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});

describe("cspHeaderName", () => {
  it("memetakan mode ke nama header CSP", () => {
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
  });
});
