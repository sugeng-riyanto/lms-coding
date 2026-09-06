/**
 * Utilitas waktu: simpan UTC, tampilkan Asia/Jakarta (PRODUCT_REQUIREMENTS.md).
 */

export const DISPLAY_TIMEZONE = "Asia/Jakarta";

/** Timestamp UTC sekarang (sumber kebenaran untuk deadline/durasi). */
export function nowUtcIso(now = new Date()): string {
  return now.toISOString();
}

/** Format ISO UTC → "15 Jan 2026, 14.30 WIB". */
export function formatJakarta(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_TIMESTAMP");
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: DISPLAY_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${parts} WIB`;
}

/** true bila timestamp sudah lewat (perbandingan selalu dalam UTC). */
export function isPastUtc(isoUtc: string, now = new Date()): boolean {
  const t = Date.parse(isoUtc);
  if (Number.isNaN(t)) throw new Error("INVALID_TIMESTAMP");
  return t <= now.getTime();
}
