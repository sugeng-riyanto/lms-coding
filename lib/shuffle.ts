import { randomBytes } from "node:crypto";

/**
 * PRNG seed string -> number (xmur3). Deterministik untuk string yang sama —
 * seed server disimpan di attempts.question_order_json agar order bisa
 * direproduksi (verifikasi/grading) tanpa menyimpan urutan eksplisit.
 */
export function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** PRNG mulberry32 — cepat, deterministik untuk seed yang sama. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle Fisher–Yates deterministik dari seed string (tidak mengubah input). */
export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rnd = mulberry32(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Pilih pool + urutan untuk satu attempt: shuffle penuh lalu ambil `size`
 * pertama. Size di luar [1, items.length) berarti seluruh soal (urutan tetap
 * diacak). Reproducible: seed yang sama + input yang sama -> output yang sama.
 */
export function pickPool<T>(items: readonly T[], size: number, seed: string): T[] {
  const shuffled = shuffleWithSeed(items, seed);
  if (size >= 1 && size < items.length) return shuffled.slice(0, Math.floor(size));
  return shuffled;
}

/** Seed acak kriptografis 128-bit (hex) — hanya dipakai di server. */
export function randomSeedHex(): string {
  return randomBytes(16).toString("hex");
}
