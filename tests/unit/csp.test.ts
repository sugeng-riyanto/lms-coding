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

  it("default TANPA in-browser code: tidak ada wasm-unsafe-eval/CDN Pyodide", () => {
    const policy = buildCspPolicy({ nonce: "n1" });
    expect(policy).not.toContain("wasm-unsafe-eval");
    expect(policy).not.toContain("cdn.jsdelivr.net");
  });

  it("inBrowserCode menambah kelonggaran SEMPIT: wasm-unsafe-eval + CDN, bukan unsafe-eval", () => {
    const policy = buildCspPolicy({ nonce: "n1", inBrowserCode: true });
    expect(policy).toContain("'wasm-unsafe-eval'");
    expect(policy).toContain("https://cdn.jsdelivr.net");
    expect(policy).toContain("connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net");
    // 'unsafe-eval' TIDAK PERNAH ditambahkan oleh mode in-browser; script-src
    // tetap bebas 'unsafe-inline' (hanya style-src yang memakainya).
    expect(policy).not.toContain("'unsafe-eval'");
    const scriptSrc = policy.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    // Sisa hardening tetap utuh.
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("frame-src per-host memuat seluruh host media-embed (yt, Drive, PhET, oPhysics)", () => {
    const policy = buildCspPolicy({ nonce: "n1" });
    expect(policy).toContain(
      "frame-src 'self' https://www.youtube-nocookie.com https://docs.google.com https://drive.google.com https://phet.colorado.edu https://ophysics.com https://*.supabase.co",
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
