import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildCspPolicy, CSP_REPORT_ENDPOINT, cspHeaderName, type CspMode } from "@/lib/csp";

/**
 * Proxy (Next 16 middleware) — dua tugas:
 *  1. Refresh token Supabase per request (pola resmi @supabase/ssr;
 *     selalu getClaims(), jangan pernah trust getSession() di server).
 *  2. Nonce-based strict CSP: nonce baru per request dikirim via header
 *     `x-nonce` + kebijakan CSP. Next.js meng-apply nonce otomatis ke inline
 *     scripts/styles saat SSR — asalkan halaman di-render dinamis.
 *
 * Rollout REPORT-ONLY (default): `CSP_REPORT_ONLY !== "false"` => header
 * Content-Security-Policy-Report-Only + endpoint /api/csp-report. Dev SELALU
 * report-only (React dev butuh 'unsafe-eval'; report-only tidak memblokir).
 */
export async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const mode: CspMode = isDev || process.env.CSP_REPORT_ONLY !== "false" ? "report-only" : "enforce";

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildCspPolicy({ nonce, isDev });
  const cspHeader = cspHeaderName(mode);

  // Nonce + CSP harus ada di REQUEST headers (agar SSR meng-inject nonce) DAN
  // di response headers (untuk browser). Mutasi in-place supaya rekreasi
  // response di setAll() di bawah tetap membawa header ini.
  request.headers.set("x-nonce", nonce);
  request.headers.set(cspHeader, policy);
  request.headers.set("Reporting-Endpoints", `csp-endpoint="${CSP_REPORT_ENDPOINT}"`);

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    });

    await supabase.auth.getClaims();
  }

  // Header CSP final — setAll() dapat membuat ulang response di atas.
  supabaseResponse.headers.set("x-nonce", nonce);
  supabaseResponse.headers.set(cspHeader, policy);
  supabaseResponse.headers.set("Reporting-Endpoints", `csp-endpoint="${CSP_REPORT_ENDPOINT}"`);

  return supabaseResponse;
}

export const config = {
  matcher: [
    {
      // Semua rute kecuali aset statis; prefetch next/link dilewati
      // (tidak dirender, nonce tidak perlu — pola resmi docs CSP).
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
