/**
 * Content Security Policy — single source untuk nonce-based strict CSP.
 *
 * Dipakai proxy.ts (Next 16 "Proxy"): nonce per-request; Next.js meng-apply
 * nonce otomatis ke inline scripts/styles saat SSR (lihat
 * node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
 *
 * Rollout REPORT-ONLY (default): proxy mengirim header
 * Content-Security-Policy-Report-Only + endpoint /api/csp-report. Operator
 * meng-enforce dengan CSP_REPORT_ONLY=false setelah aliran laporan bersih.
 * Dev SELALU report-only (React dev butuh 'unsafe-eval' — dokumentasi resmi).
 */

export const CSP_REPORT_ENDPOINT = "/api/csp-report";

/**
 * frame-src per-host — hanya host yang benar-benar dipakai
 * components/media-embed.tsx. Host lain DIBLOKIR; perluas hanya via edit +
 * e2e (DEPLOYMENT.md §4.7).
 */
const FRAME_SRC = [
  "'self'",
  "https://www.youtube-nocookie.com", // YouTube — src selalu DIREKONSTRUKSI dari id
  "https://docs.google.com", // viewer PDF Google Drive (host umum sekolah)
  "https://*.supabase.co", // PDF di private Storage via signed URL
].join(" ");

export interface CspOptions {
  nonce: string;
  /** Dev: 'unsafe-eval' (React dev) + Supabase lokal http://127.0.0.1. */
  isDev?: boolean;
}

/** Bangun satu string kebijakan (enforce & report-only memakai string sama). */
export function buildCspPolicy({ nonce, isDev = false }: CspOptions): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // React dev memakai eval untuk stack trace/source maps — hanya di dev.
    // Produksi TIDAK butuh eval (React/Next tidak memakainya).
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    // Dev: Supabase lokal + HMR websocket (report-only, jadi tidak memblokir).
    ...(isDev ? ["http://127.0.0.1:*", "ws://127.0.0.1:*"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // style-src memakai 'unsafe-inline' karena chart/dashboard memakai style
    // attribute DINAMIS (height/width dari data) yang tidak bisa jadi class;
    // attribute style tidak dapat mengeksekusi kode. Tradeoff terdokumentasi.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    `connect-src ${connectSrc}`,
    `frame-src ${FRAME_SRC}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // upgrade-insecure-requests sengaja TIDAK dipakai: dev memakai Supabase
    // lokal http://127.0.0.1:* dan HTTPS sudah dipaksakan di reverse proxy
    // (DEPLOYMENT.md §4). Menambahkannya akan memutus dev.
    `report-uri ${CSP_REPORT_ENDPOINT}`,
    "report-to csp-endpoint",
  ].join("; ");
}

export type CspMode = "enforce" | "report-only";

export function cspHeaderName(mode: CspMode): string {
  return mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}
