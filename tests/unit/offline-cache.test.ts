import { describe, expect, it } from "vitest";
import {
  CACHE_TTL_MS,
  activityCacheKey,
  cacheClear,
  cacheDelete,
  cacheGet,
  cachePut,
  estimateSize,
  evictToBudget,
  isExpired,
  lessonCacheKey,
  levelCacheKey,
} from "@/lib/offline-cache";

describe("kunci cache", () => {
  it("prefix per tipe entitas", () => {
    expect(activityCacheKey("abc")).toBe("activity:abc");
    expect(lessonCacheKey("abc")).toBe("lesson:abc");
    expect(levelCacheKey("abc")).toBe("level:abc");
  });
});

describe("estimateSize", () => {
  it("0 untuk null, proporsional untuk string panjang", () => {
    expect(estimateSize(null)).toBe(64);
    const a = estimateSize({ body: "x".repeat(1000) });
    expect(a).toBeGreaterThan(2000);
    expect(a).toBeLessThan(2200);
  });
});

describe("isExpired", () => {
  const now = 1_000_000;
  it("dalam TTL → false; lewat TTL → true", () => {
    expect(isExpired(now, now + CACHE_TTL_MS - 1)).toBe(false);
    expect(isExpired(now, now + CACHE_TTL_MS)).toBe(false);
    expect(isExpired(now, now + CACHE_TTL_MS + 1)).toBe(true);
  });
});

describe("evictToBudget — LRU", () => {
  it("total ≤ budget → tidak ada eviction", () => {
    expect(
      evictToBudget(
        [
          { key: "a", size: 100, lastAccess: 1 },
          { key: "b", size: 200, lastAccess: 2 },
        ],
        300,
      ),
    ).toEqual([]);
  });
  it("evict LRU dulu sampai total ≤ budget", () => {
    const out = evictToBudget(
      [
        { key: "lama", size: 300, lastAccess: 1 },
        { key: "baru", size: 100, lastAccess: 3 },
        { key: "tengah", size: 200, lastAccess: 2 },
      ],
      250,
    );
    expect(out).toEqual(["lama", "tengah"]); // total tersisa 100 ≤ 250
  });
  it("entri tunggal melebihi budget tetap di-evict", () => {
    expect(evictToBudget([{ key: "raksasa", size: 999, lastAccess: 5 }], 250)).toEqual(["raksasa"]);
  });
  it("deterministik untuk input sama", () => {
    const input = [
      { key: "a", size: 10, lastAccess: 9 },
      { key: "b", size: 10, lastAccess: 1 },
    ];
    expect(evictToBudget(input, 15)).toEqual(["b"]);
    expect(evictToBudget(input, 15)).toEqual(["b"]);
  });
});

// Lapisan IndexedDB hanya bisa diuji bila runtime menyediakan indexedDB
// (Node tidak; tambahkan fake-indexeddb nanti bila perlu). Fail-soft di Node:
// semua fungsi harus no-op null tanpa melempar.
describe.runIf(typeof indexedDB !== "undefined")("lapisan IndexedDB (browser)", () => {
  it("put → get → delete → clear", async () => {
    await cacheClear();
    expect(await cacheGet("activity:x")).toBeNull();
    await cachePut("activity:x", { title: "A", content: { body: "hai" } });
    const hit = await cacheGet<{ title: string }>("activity:x");
    expect(hit?.value.title).toBe("A");
    expect(hit?.cachedAt).toBeGreaterThan(0);
    await cacheDelete("activity:x");
    expect(await cacheGet("activity:x")).toBeNull();
    await cacheClear();
  });
});
