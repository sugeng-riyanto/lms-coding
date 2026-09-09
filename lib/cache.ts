/**
 * Stale-while-revalidate caching utilities for server components.
 *
 * Pattern: fetch → cache for TTL → serve stale while revalidating in background.
 * Uses Next.js built-in `unstable_cache` (or manual Map-based cache for SSR).
 */

const cache = new Map<string, { data: unknown; expiry: number }>();

/**
 * Cached fetch with stale-while-revalidate semantics.
 * Returns cached data immediately if available; revalidates in background after TTL.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttlMs?: number; staleMs?: number } = {},
): Promise<T> {
  const { ttlMs = 60_000, staleMs = 300_000 } = options;
  const now = Date.now();
  const entry = cache.get(key);

  // Return fresh data
  if (entry && entry.expiry > now) {
    return entry.data as T;
  }

  // Return stale data while revalidating
  if (entry && entry.expiry + staleMs > now) {
    // Background revalidation (fire and forget)
    fetcher()
      .then((fresh) => {
        cache.set(key, { data: fresh, expiry: Date.now() + ttlMs });
      })
      .catch(() => {
        // Keep stale data on revalidation failure
      });
    return entry.data as T;
  }

  // No cache or expired beyond stale threshold — fetch fresh
  const data = await fetcher();
  cache.set(key, { data, expiry: now + ttlMs });
  return data;
}

/**
 * Invalidate a cached key (call after writes).
 */
export function invalidateCache(key: string) {
  cache.delete(key);
}

/**
 * Clear all cached entries (for testing or memory pressure).
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get cache stats for monitoring.
 */
export function getCacheStats() {
  const now = Date.now();
  let fresh = 0;
  let stale = 0;
  let expired = 0;
  for (const entry of cache.values()) {
    if (entry.expiry > now) fresh++;
    else if (entry.expiry + 300_000 > now) stale++;
    else expired++;
  }
  return { total: cache.size, fresh, stale, expired };
}
