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
  "https://drive.google.com", // preview Google Drive (PDF/video, embed_web/embed_video)
  "https://phet.colorado.edu", // sim sains interaktif (embed_web)
  "https://ophysics.com", // sim fisika/math (embed_web)
  "https://*.supabase.co", // PDF di private Storage via signed URL
].join(" ");

export interface CspOptions {
  nonce: string;
  /** Dev: 'unsafe-eval' (React dev) + Supabase lokal http://127.0.0.1. */
  isDev?: boolean;
  /**
   * Eksekusi kode in-browser (Pyodide/WASM) AKTIF — lihat
   * NEXT_PUBLIC_CODE_RUNNER_IN_BROWSER. Kelonggaran SEMPIT dan eksplisit:
   * `'wasm-unsafe-eval'` (kompilasi WASM Pyodide, BUKAN eval JS) + host CDN
   * Pyodide di script-src/connect-src. TIDAK pernah menambah 'unsafe-eval'.
   * Tanpa flag ini kebijakan tetap ketat (default).
   */
  inBrowserCode?: boolean;
}

/** Bangun satu string kebijakan (enforce & report-only memakai string sama). */
export function buildCspPolicy({ nonce, isDev = false, inBrowserCode = false }: CspOptions): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // React dev memakai eval untuk stack trace/source maps — hanya di dev.
    // Produksi TIDAK butuh eval (React/Next tidak memakainya).
    ...(isDev ? ["'unsafe-eval'"] : []),
    // Pyodide (in-browser): kompilasi WASM butuh token khusus ini — bukan
    // eval JS. Host CDN perluasan di script-src (muatan pyodide.js).
    ...(inBrowserCode ? ["'wasm-unsafe-eval'", "https://cdn.jsdelivr.net"] : []),
  ].join(" ");

  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    // Dev: Supabase lokal + HMR websocket (report-only, jadi tidak memblokir).
    ...(isDev ? ["http://127.0.0.1:*", "ws://127.0.0.1:*"] : []),
    // In-browser code: fetch runtime WASM/data Pyodide dari CDN.
    ...(inBrowserCode ? ["https://cdn.jsdelivr.net"] : []),
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
