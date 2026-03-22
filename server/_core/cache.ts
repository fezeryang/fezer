/**
 * Minimal cache control and invalidation for content endpoints
 * Consistency-first strategy: short TTLs, aggressive invalidation
 */

type CacheKey = "works:list" | "works:detail" | "posts:list" | "posts:detail";

interface CacheState {
  lastInvalidated: Date;
  invalidationCount: number;
}

// In-memory invalidation tracking (sufficient for single-instance deployment)
const cacheState = new Map<CacheKey, CacheState>();

/**
 * Get Cache-Control header value for public read endpoints
 * Short TTLs to minimize stale content window
 */
export function getCacheControlHeader(key: CacheKey): string {
  // 60 seconds for lists, 120 seconds for details
  const maxAge = key.includes("list") ? 60 : 120;
  return `public, max-age=${maxAge}, stale-while-revalidate=30`;
}

/**
 * Mark cache as invalid for a given key
 * Called when mutations occur (publish/update/softDelete)
 */
export function invalidateCache(key: CacheKey): void {
  const now = new Date();
  const existing = cacheState.get(key);

  cacheState.set(key, {
    lastInvalidated: now,
    invalidationCount: (existing?.invalidationCount ?? 0) + 1,
  });

  // Log invalidation without leaking sensitive data
  console.log(
    `[Cache] Invalidated ${key} at ${now.toISOString()} (count: ${cacheState.get(key)!.invalidationCount})`
  );
}

/**
 * Invalidate all cache entries for a content type
 * Used when mutations affect both list and detail views
 */
export function invalidateContentType(type: "works" | "posts"): void {
  invalidateCache(`${type}:list`);
  invalidateCache(`${type}:detail`);
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): Record<
  CacheKey,
  { lastInvalidated: string | null; invalidationCount: number }
> {
  const stats = {} as Record<
    CacheKey,
    { lastInvalidated: string | null; invalidationCount: number }
  >;

  const allKeys: CacheKey[] = [
    "works:list",
    "works:detail",
    "posts:list",
    "posts:detail",
  ];

  for (const key of allKeys) {
    const state = cacheState.get(key);
    stats[key] = {
      lastInvalidated: state?.lastInvalidated.toISOString() ?? null,
      invalidationCount: state?.invalidationCount ?? 0,
    };
  }

  return stats;
}

/**
 * Log cache hit (called when serving cached content)
 */
export function logCacheHit(key: CacheKey): void {
  const state = cacheState.get(key);
  const lastInvalidated = state?.lastInvalidated?.toISOString() ?? "never";
  console.log(
    `[Cache] Hit ${key} (last invalidated: ${lastInvalidated})`
  );
}
