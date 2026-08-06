// ═══════════════════════════════════════════════════════════
// IN-MEMORY CACHE SERVICE
// Replace with Redis for production. Interface is
// designed for drop-in replacement.
// ═══════════════════════════════════════════════════════════

type CacheEntry<T> = {
  value: T
  expiresAt: number
  createdAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Set a cache entry.
 */
export function setCache<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
  })
}

/**
 * Get a cache entry. Returns undefined if expired or not found.
 */
export function getCache<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return undefined
  }
  return entry.value as T
}

/**
 * Delete a cache entry.
 */
export function deleteCache(key: string): boolean {
  return cache.delete(key)
}

/**
 * Clear all cache entries or by pattern prefix.
 */
export function clearCache(prefix?: string): number {
  if (!prefix) {
    const count = cache.size
    cache.clear()
    return count
  }
  let count = 0
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
      count++
    }
  }
  return count
}

/**
 * Get or set pattern: fetch from cache, or compute and cache.
 */
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = getCache<T>(key)
  if (cached !== undefined) return cached

  const value = await fetcher()
  setCache(key, value, ttlMs)
  return value
}

/**
 * Get cache statistics.
 */
export function getCacheStats() {
  let valid = 0
  let expired = 0
  const now = Date.now()
  for (const entry of cache.values()) {
    if (now > entry.expiresAt) expired++
    else valid++
  }
  return { total: cache.size, valid, expired }
}

// Cache key prefixes for different services
export const CACHE_KEYS = {
  USER: (id: string) => `user:${id}`,
  PROFILE: (id: string) => `profile:${id}`,
  SEARCH: (query: string) => `search:${query}`,
  ADVERTISEMENT: (position: string) => `ad:${position}`,
  CONFIG: (key: string) => `config:${key}`,
  ANALYTICS: (type: string) => `analytics:${type}`,
  MEMBERSHIP_PLANS: 'membership:plans',
  PUBLIC_CONFIG: 'config:public',
} as const

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) cache.delete(key)
  }
}, 10 * 60 * 1000) // Every 10 minutes
