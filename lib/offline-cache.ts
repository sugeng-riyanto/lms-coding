/**
 * Slice 1 offline plan (docs/plan-offline-local-bridge.md): read-cache
 * IndexedDB untuk konten yang SUDAH dibuka murid (activity/lesson/level).
 *
 * Aturan:
 * - Hanya menyimpan data dari respons yang sudah lolos RLS — cache dibuat dari
 *   apa yang server kirim, tidak pernah memuat sendiri.
 * - TTL 24 jam; ukuran dibatasi (5 MB) dengan eviction LRU (lastAccess).
 * - Fail-soft: semua fungsi no-op/null saat dipanggil di server (Node) atau
 *   saat IndexedDB tidak tersedia (mode privat) — cache tidak boleh
 *   memecahkan aplikasi.
 * - Sumber kebenaran tetap hosted (D1); ini hanya cache-baca.
 */

export const CACHE_DB = "lms-offline-cache";
export const CACHE_STORE = "pages";
export const CACHE_VERSION = 1;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam
export const MAX_CACHE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface CacheEntry {
  key: string;
  value: unknown;
  size: number;
  cachedAt: number;
  lastAccess: number;
}

export interface CacheHit<T = unknown> {
  value: T;
  cachedAt: number;
}

export function activityCacheKey(activityId: string): string {
  return `activity:${activityId}`;
}
export function lessonCacheKey(lessonId: string): string {
  return `lesson:${lessonId}`;
}
export function levelCacheKey(levelId: string): string {
  return `level:${levelId}`;
}

/** Estimasi byte penyimpanan (UTF-16: 2 byte/char + overhead record). */
export function estimateSize(value: unknown): number {
  if (value === null || value === undefined) return 64;
  const json = JSON.stringify(value);
  return (json?.length ?? 0) * 2 + 64;
}

export function isExpired(cachedAt: number, now: number, ttlMs: number = CACHE_TTL_MS): boolean {
  return now - cachedAt > ttlMs;
}

/**
 * Pilih kunci yang harus di-evict (LRU dulu) agar total ≤ budget.
 * Murni & deterministik — diuji tanpa IndexedDB.
 */
export function evictToBudget(
  records: { key: string; size: number; lastAccess: number }[],
  budget: number,
): string[] {
  let total = records.reduce((sum, r) => sum + r.size, 0);
  const sorted = [...records].sort((a, b) => a.lastAccess - b.lastAccess);
  const out: string[] = [];
  for (const r of sorted) {
    if (total <= budget) break;
    out.push(r.key);
    total -= r.size;
  }
  return out;
}

// ---------- Lapisan IndexedDB (client-only, fail-soft) ----------

function dbAvailable(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (!dbAvailable()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(CACHE_DB, CACHE_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

/** Simpan entri; lalu evict LRU bila total melebihi budget. */
export async function cachePut(key: string, value: unknown): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  try {
    const now = Date.now();
    const entry: CacheEntry = { key, value, size: estimateSize(value), cachedAt: now, lastAccess: now };
    await reqToPromise(db.transaction(CACHE_STORE, "readwrite").objectStore(CACHE_STORE).put(entry));

    // Enforce budget: baca semua record, evict LRU bila perlu.
    const tx = db.transaction(CACHE_STORE, "readonly");
    const store = tx.objectStore(CACHE_STORE);
    const all = await reqToPromise(store.getAll() as IDBRequest<CacheEntry[]>);
    const total = (all ?? []).reduce((sum, r) => sum + r.size, 0);
    if (total > MAX_CACHE_BYTES) {
      const evict = evictToBudget(all ?? [], MAX_CACHE_BYTES);
      if (evict.length > 0) {
        const wtx = db.transaction(CACHE_STORE, "readwrite");
        const wstore = wtx.objectStore(CACHE_STORE);
        for (const k of evict) wstore.delete(k);
        await new Promise<void>((resolve) => {
          wtx.oncomplete = () => resolve();
          wtx.onerror = () => resolve();
          wtx.onabort = () => resolve();
        });
      }
    }
  } catch {
    // Fail-soft: cache tidak boleh mengganggu render.
  } finally {
    db.close();
  }
}

/** Baca entri; null bila tidak ada / kedaluwarsa (lalu hapus) / gagal. */
export async function cacheGet<T = unknown>(key: string): Promise<CacheHit<T> | null> {
  const db = await openCacheDb();
  if (!db) return null;
  try {
    const entry = await reqToPromise(
      db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(key) as IDBRequest<
        CacheEntry | undefined
      >,
    );
    if (!entry) return null;
    if (isExpired(entry.cachedAt, Date.now())) {
      await reqToPromise(db.transaction(CACHE_STORE, "readwrite").objectStore(CACHE_STORE).delete(key));
      return null;
    }
    // Refresh lastAccess (tanpa menunggu tulis selesai).
    const upd: CacheEntry = { ...entry, lastAccess: Date.now() };
    db.transaction(CACHE_STORE, "readwrite").objectStore(CACHE_STORE).put(upd);
    return { value: entry.value as T, cachedAt: entry.cachedAt };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  try {
    await reqToPromise(db.transaction(CACHE_STORE, "readwrite").objectStore(CACHE_STORE).delete(key));
  } catch {
    // no-op
  } finally {
    db.close();
  }
}

export async function cacheClear(): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  try {
    await reqToPromise(db.transaction(CACHE_STORE, "readwrite").objectStore(CACHE_STORE).clear());
  } catch {
    // no-op
  } finally {
    db.close();
  }
}
