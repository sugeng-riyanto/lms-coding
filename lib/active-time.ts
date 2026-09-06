/**
 * Active-time (heartbeat) — logika MURNI untuk "waktu belajar yang jujur"
 * (STUDENT_EXPERIENCE.md): waktu TIDAK dihitung hanya karena halaman terbuka.
 *
 * Aturan:
 * - Heartbeat hanya dikirim saat tab visible DAN ada aktivitas pengguna
 *   (pointer/keyboard) dalam jendela; idle → tidak ada heartbeat.
 * - Durasi aktif per heartbeat di-clamp (default maks 120 detik) dan minimal
 *   jarak antar heartbeat (default 20 detik) — mencegah tab terbuka menghitung
 *   waktu terus-menerus.
 * - Server memvalidasi ULANG metadata heartbeat (bukan percaya client):
 *   nilai non-finite/negatif/raksasa ditolak/di-clamp.
 */

export const MAX_HEARTBEAT_ACTIVE_MS = 120_000;
export const MIN_HEARTBEAT_INTERVAL_MS = 20_000;
export const MAX_DRAFT_CHARS = 4_000;

/** Gap antar heartbeat yang masih dianggap satu sesi belajar (10 menit). */
export const SESSION_CONTINUATION_GAP_MS = 10 * 60_000;
/** Batas keamanan active_seconds per sesi (6 jam) — clamp anti-gaming. */
export const MAX_SESSION_ACTIVE_SECONDS = 21_600;

/** Coerce + clamp durasi aktif (ms) ke rentang sah [0, MAX]. Non-finite → 0. */
export function clampActiveMs(ms: unknown): number {
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_HEARTBEAT_ACTIVE_MS, Math.floor(n));
}

export type HeartbeatValidation = { ok: true; activeMs: number } | { ok: false; reason: string };

/** Validasi metadata heartbeat; hasilnya sudah di-clamp server-side. */
export function validateHeartbeatMetadata(metadata: Record<string, unknown>): HeartbeatValidation {
  const raw = metadata.activeMs;
  const activeMs = clampActiveMs(raw);
  if (activeMs <= 0) return { ok: false, reason: "ACTIVE_MS_INVALID" };
  // Nilai raksasa (mis. > 2× clamp) menandakan client nakal/rusak → tolak.
  if (typeof raw === "number" && raw > MAX_HEARTBEAT_ACTIVE_MS * 2) {
    return { ok: false, reason: "ACTIVE_MS_ABSURD" };
  }
  return { ok: true, activeMs };
}

/** Apakah heartbeat berikutnya boleh dikirim (jarak minimum terpenuhi)? */
export function nextHeartbeatAllowed(
  lastSentAtMs: number | null,
  nowMs: number,
  minIntervalMs: number = MIN_HEARTBEAT_INTERVAL_MS,
): boolean {
  if (lastSentAtMs === null) return true;
  return nowMs - lastSentAtMs >= minIntervalMs;
}

/** Heartbeat pada `nowMs` melanjutkan sesi yang berakhir `lastEndedAtMs`? */
export function isSessionContinuation(
  lastEndedAtMs: number,
  nowMs: number,
  gapMs: number = SESSION_CONTINUATION_GAP_MS,
): boolean {
  return nowMs - lastEndedAtMs <= gapMs;
}

/** Clamp active_seconds sesi ke rentang sah [0, MAX]. Non-finite → 0. */
export function clampSessionActiveSeconds(sec: number): number {
  const n = typeof sec === "number" ? sec : Number(sec);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_SESSION_ACTIVE_SECONDS, Math.floor(n));
}

/**
 * Validasi metadata draft_saved: hanya panjang teks (minimisasi data).
 * Kunci `chars` dipakai ReflectionBox; lesson player lama mengirim `length` —
 * dua-duanya diterima agar tidak ada produsen draft yang patah.
 */
export function validateDraftMetadata(
  metadata: Record<string, unknown>,
): { ok: true; chars: number } | { ok: false; reason: string } {
  const raw = metadata.chars ?? metadata.length;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return { ok: false, reason: "CHARS_INVALID" };
  if (n > MAX_DRAFT_CHARS) return { ok: false, reason: "CHARS_TOO_LONG" };
  return { ok: true, chars: Math.floor(n) };
}
