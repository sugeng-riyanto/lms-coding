import { describe, expect, it } from "vitest";
import { hashSeed, mulberry32, pickPool, randomSeedHex, shuffleWithSeed } from "@/lib/shuffle";

const QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"];

describe("seeded PRNG", () => {
  it("hashSeed deterministik & berubah untuk string beda", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
    expect(hashSeed("")).toBe(hashSeed(""));
  });
  it("mulberry32 menghasilkan nilai [0,1) dan deterministik", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const xa = a();
      const xb = b();
      expect(xa).toBe(xb); // dua instance seed sama → urutan sama
      expect(xa).toBeGreaterThanOrEqual(0);
      expect(xa).toBeLessThan(1);
    }
  });
});

describe("shuffleWithSeed reproducibility", () => {
  it("seed sama → urutan sama (lintas panggilan & instance)", () => {
    const s1 = shuffleWithSeed(QUESTIONS, "seed-A");
    const s2 = shuffleWithSeed(QUESTIONS, "seed-A");
    expect(s1).toEqual(s2);
    expect(s1).toHaveLength(QUESTIONS.length);
    // permutasi lengkap (multiset sama)
    expect([...s1].sort()).toEqual([...QUESTIONS].sort());
  });
  it("seed berbeda → urutan berbeda (probabilistik, seed tetap)", () => {
    const s1 = shuffleWithSeed(QUESTIONS, "seed-A");
    const s2 = shuffleWithSeed(QUESTIONS, "seed-B");
    expect(s1).not.toEqual(s2);
  });
  it("tidak mengubah input", () => {
    const copy = [...QUESTIONS];
    shuffleWithSeed(QUESTIONS, "x");
    expect(QUESTIONS).toEqual(copy);
  });
  it("seed yang sama + input sama → reproducible untuk grading/verifikasi", () => {
    const seed = "8f14e45fceea167a5a36dedd4bea2543";
    const order1 = shuffleWithSeed(QUESTIONS.slice(0, 5), seed);
    const order2 = shuffleWithSeed(QUESTIONS.slice(0, 5), seed);
    expect(order1).toEqual(order2);
  });
});

describe("pickPool", () => {
  it("pool < total → subset acak dengan ukuran persis", () => {
    const pool = pickPool(QUESTIONS, 4, "pool-seed");
    expect(pool).toHaveLength(4);
    expect(pool.every((q) => QUESTIONS.includes(q))).toBe(true);
  });
  it("reproducible: seed sama → pool + urutan sama", () => {
    expect(pickPool(QUESTIONS, 4, "pool-seed")).toEqual(pickPool(QUESTIONS, 4, "pool-seed"));
  });
  it("size >= total → seluruh soal (urutan tetap diacak)", () => {
    expect(pickPool(QUESTIONS, 10, "s")).toHaveLength(10);
    expect(pickPool(QUESTIONS, 99, "s")).toHaveLength(10);
  });
  it("size invalid (0/negatif) → seluruh soal", () => {
    expect(pickPool(QUESTIONS, 0, "s")).toHaveLength(10);
    expect(pickPool(QUESTIONS, -3, "s")).toHaveLength(10);
  });
  it("randomSeedHex: 32 hex, unik antar panggilan", () => {
    const a = randomSeedHex();
    const b = randomSeedHex();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
