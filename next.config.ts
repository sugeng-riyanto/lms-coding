import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // E2E/Playwright memakai 127.0.0.1; tanpanya Next dev memblokir HMR/font
  // dev (403) sehingga halaman tidak terhidrasi dan interaksi gagal.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // CSP TIDAK di sini: kebijakan nonce-based (per-request) dikirim oleh
          // proxy.ts — lihat lib/csp.ts. Header statis di sini justru akan
          // di-union dengan kebijakan nonce dan memblokir semua script.
        ],
      },
    ];
  },
};

export default nextConfig;
