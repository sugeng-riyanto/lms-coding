/**
 * Parse + redaksi laporan CSP (format CSP3 `csp-report`) untuk endpoint
 * /api/csp-report. Murni (tanpa I/O) agar mudah diuji.
 *
 * Aturan redaksi (runbooks §7.2 — jangan pernah log data murid):
 *  - query string DAN hash dibuang dari semua URI (dapat memuat PII);
 *  - `script-sample` TIDAK pernah diekstrak (bisa memuat kode/data sensitif);
 *  - non-URL (mis. "inline", "self") dipotong ke 200 karakter.
 */

export interface CspViolation {
  disposition: "enforce" | "report";
  effectiveDirective: string;
  violatedDirective: string;
  blockedUri: string;
  documentUri: string;
  referrer: string;
  lineNumber: number | null;
  columnNumber: number | null;
}

const MAX_FIELD = 200;

/** Buang query string/hash dari URI; non-URL dipotong panjangnya. */
export function redactUri(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  // Token khusus CSP ("inline", "self", "data") atau string tanpa skema bukan
  // URL — potong panjangnya, jangan di-resolve jadi URL relatif.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return value.slice(0, MAX_FIELD);
  try {
    const u = new URL(value);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return value.slice(0, MAX_FIELD);
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const str = (v: unknown, max = MAX_FIELD): string => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Parse body report CSP. Mengembalikan null untuk body non-objek, tanpa
 * `csp-report`, atau laporan tanpa effective-directive (diam-diam diabaikan).
 */
export function parseCspReport(input: unknown): CspViolation | null {
  if (typeof input !== "object" || input === null) return null;
  const report = (input as { "csp-report"?: unknown })["csp-report"];
  if (typeof report !== "object" || report === null) return null;
  const r = report as Record<string, unknown>;
  const effective = str(r["effective-directive"]);
  if (!effective) return null;
  return {
    disposition: r["disposition"] === "enforce" ? "enforce" : "report",
    effectiveDirective: effective,
    violatedDirective: str(r["violated-directive"]),
    blockedUri: redactUri(r["blocked-uri"]),
    documentUri: redactUri(r["document-uri"]),
    referrer: redactUri(r["referrer"]),
    lineNumber: num(r["line-number"]),
    columnNumber: num(r["column-number"]),
  };
}
