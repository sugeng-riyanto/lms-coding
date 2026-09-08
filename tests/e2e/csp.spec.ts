import { test, expect } from "@playwright/test";

/**
 * CSP nonce-based — assertions pada HEADER yang benar-benar disajikan
 * (bukan unit test string): frame-src allowlist per-host, pengarah hardening,
 * nonce segar tiap request, nonce ter-inject ke HTML, dan perilaku endpoint
 * /api/csp-report. Hermetic: tanpa backend/session (rute publik + proxy), jadi
 * berjalan di CI (dev server demo) dan terhadap deployment enforce.
 */
const FRAME_SRC_ALLOWLIST =
  "frame-src 'self' https://www.youtube-nocookie.com https://docs.google.com https://drive.google.com https://phet.colorado.edu https://ophysics.com https://*.supabase.co";
const HARDENING_DIRECTIVES = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "media-src 'self' https:",
  "report-uri /api/csp-report",
  "report-to csp-endpoint",
];

/** Ambil header CSP (enforce atau report-only) + nonce, atau null. */
function cspOf(headers: Record<string, string>) {
  const policy = headers["content-security-policy"] ?? headers["content-security-policy-report-only"];
  const nonce = headers["x-nonce"];
  return policy && nonce ? { policy, nonce } : null;
}

test.describe("CSP nonce-based (served headers)", () => {
  for (const path of ["/", "/login", "/unauthorized", "/account-inactive"]) {
    test(`halaman shell ${path} menyajikan frame-src allowlist + hardening + nonce di HTML`, async ({
      request,
    }) => {
      const res = await request.get(path);
      expect(res.ok()).toBeTruthy();
      const csp = cspOf(res.headers());
      expect(csp, `${path}: header CSP + x-nonce wajib ada`).not.toBeNull();
      if (!csp) return;

      expect(csp.policy, `${path}: nonce di script-src`).toContain("'nonce-");
      expect(csp.policy, `${path}: strict-dynamic`).toContain("'strict-dynamic'");
      expect(csp.policy, `${path}: frame-src per-host`).toContain(FRAME_SRC_ALLOWLIST);
      for (const directive of HARDENING_DIRECTIVES) {
        expect(csp.policy, `${path}: ${directive}`).toContain(directive);
      }
      // script-src bebas 'unsafe-inline' (style-src boleh — tradeoff terdokumentasi).
      const scriptSrc = csp.policy.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
      expect(scriptSrc, `${path}: script-src tanpa unsafe-inline`).not.toContain("'unsafe-inline'");

      // Nonce respons ter-inject ke script tag HTML (request yang sama).
      const html = await res.text();
      expect(html, `${path}: nonce respons muncul di HTML`).toContain(`nonce="${csp.nonce}"`);
      const tags = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
      expect(tags.length, `${path}: HTML memuat script`).toBeGreaterThan(0);
      const withoutNonce = tags.filter((t) => !/nonce=/.test(t));
      expect(withoutNonce, `${path}: SEMUA script tag ber-nonce (0 tanpa)`).toEqual([]);
    });
  }

  test("nonce segar tiap request (tidak bisa ditebak/diulang)", async ({ request }) => {
    const first = cspOf((await request.get("/")).headers());
    const second = cspOf((await request.get("/")).headers());
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (!first || !second) return;
    expect(first.nonce).not.toBe(second.nonce);
  });

  test("mode enforce (bila aktif) bebas unsafe-eval/unsafe-inline di script-src", async ({ request }) => {
    const res = await request.get("/");
    const enforced = res.headers()["content-security-policy"];
    if (enforced) {
      // 'unsafe-inline' SAH di style-src (tradeoff terdokumentasi) — periksa
      // hanya segmen script-src.
      const scriptSrc = enforced.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
      expect(scriptSrc).not.toContain("'unsafe-eval'");
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    }
    // Dev/rollout memakai Report-Only + 'unsafe-eval' (React dev) — sah, tidak diuji di sini.
  });

  test("endpoint /api/csp-report: 204 valid · 400 JSON buruk · 415 content-type · 413 besar", async ({
    request,
  }) => {
    const valid = await request.post("/api/csp-report", {
      headers: { "Content-Type": "application/csp-report" },
      data: {
        "csp-report": {
          disposition: "report",
          "effective-directive": "script-src-elem",
          "blocked-uri": "https://evil.example/a.js?session=abc",
          "document-uri": "https://lms.example/learn",
        },
      },
    });
    expect(valid.status()).toBe(204);

    const badJson = await request.post("/api/csp-report", {
      headers: { "Content-Type": "application/json" },
      // Buffer = body mentah; string biasa justru di-JSON-serialize jadi
      // `"not json"` yang VALID dan menghasilkan 204.
      data: Buffer.from("not json"),
    });
    expect(badJson.status()).toBe(400);

    const badContentType = await request.post("/api/csp-report", {
      headers: { "Content-Type": "text/plain" },
      data: "{}",
    });
    expect(badContentType.status()).toBe(415);

    const oversized = await request.post("/api/csp-report", {
      headers: { "Content-Type": "application/csp-report" },
      data: { "csp-report": { "effective-directive": "x", pad: "x".repeat(70_000) } },
    });
    expect(oversized.status()).toBe(413);
  });
});
