interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Token-bucket in-memory (single instance). Untuk multi-instance gunakan Redis/Supabase. */
export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

export function __resetRateLimits(): void {
  buckets.clear();
}
