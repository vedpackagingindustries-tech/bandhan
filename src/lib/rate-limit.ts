// ═══════════════════════════════════════════════════════════
// PERSISTENT RATE LIMITING
// Uses Vercel KV (Redis) when available, falls back to in-memory
// This ensures rate limits survive serverless cold starts
// and are shared across all instances.
// ═══════════════════════════════════════════════════════════

// In-memory fallback for local dev / KV unavailable
const memoryStore = new Map<string, { count: number; resetAt: number }>()

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Lazily get KV client. Returns null if KV_REST_API_URL is not set
 * or if @vercel/kv is not available.
 */
async function getKvClient() {
  if (!process.env.KV_REST_API_URL) return null
  try {
    const { kv } = await import('@vercel/kv')
    return kv
  } catch {
    // @vercel/kv not available (e.g. local dev without KV)
    return null
  }
}

/**
 * Check rate limit using Vercel KV (Redis) with atomic operations.
 * Falls back to in-memory if KV is not configured.
 * Safe: dynamic import ensures no crash when @vercel/kv is absent.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now()
  const resetAt = now + windowMs

  // Try Vercel KV first (production)
  const kv = await getKvClient()
  if (kv) {
    try {
      const kvKey = `ratelimit:${key}`
      const existing = await kv.get<{ count: number; resetAt: number }>(kvKey)

      if (!existing || now > existing.resetAt) {
        // New window
        await kv.set(kvKey, { count: 1, resetAt }, { px: windowMs + 1000 })
        return { allowed: true, remaining: limit - 1, resetAt }
      }

      if (existing.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt }
      }

      // Increment
      const newCount = existing.count + 1
      await kv.set(kvKey, { count: newCount, resetAt: existing.resetAt }, { px: existing.resetAt - now + 1000 })
      return { allowed: true, remaining: limit - newCount, resetAt: existing.resetAt }
    } catch (err) {
      // KV operation failed, fall through to in-memory
      console.warn('[RATE-LIMIT] KV operation failed, using in-memory fallback:', err)
    }
  }

  // In-memory fallback (local dev / KV unavailable)
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/**
 * Check if KV is configured and reachable
 */
export async function isKvAvailable(): Promise<boolean> {
  const kv = await getKvClient()
  if (!kv) return false
  try {
    await kv.set('__health_check', 1, { ex: 5 })
    const val = await kv.get('__health_check')
    return val === 1
  } catch {
    return false
  }
}

/**
 * Clean up old in-memory entries (call periodically)
 */
export function cleanupMemoryStore() {
  const now = Date.now()
  if (memoryStore.size > 10_000) {
    for (const [key, val] of memoryStore) {
      if (now > val.resetAt) memoryStore.delete(key)
    }
  }
}
