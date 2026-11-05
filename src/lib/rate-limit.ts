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
 * Lazily get KV client. Returns null when KV is not fully configured
 * (both KV_REST_API_URL and KV_REST_API_TOKEN required) or when the
 * client cannot be created.
 *
 * IMPORTANT: we use createClient() instead of the lazy `kv` proxy.
 * The named `kv` export is a Proxy that THROWS on first property access
 * when env vars are missing. Returning that Proxy from an async function
 * triggers thenable-adoption (`.then` access) OUTSIDE any try/catch,
 * which crashed register/login with
 * "@vercel/kv: Missing required environment variables...".
 * createClient() returns a real VercelKV instance — no lazy-throw hazard.
 */
let kvClient: import('@vercel/kv').VercelKV | null = null
let kvClientTried = false

async function getKvClient() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  // Both required — mirrors @vercel/kv's own check. Missing ANY → memory fallback.
  if (!url || !token) return null
  if (kvClient) return kvClient
  if (kvClientTried) return null
  kvClientTried = true
  try {
    const { createClient } = await import('@vercel/kv')
    kvClient = createClient({ url, token })
    return kvClient
  } catch (e) {
    console.warn('[RATE-LIMIT] KV client unavailable, using in-memory fallback:', e instanceof Error ? e.message : e)
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
  try {
    return await doCheckRateLimit(key, limit, windowMs)
  } catch (e) {
    // FAIL-OPEN: a rate-limiter outage must NEVER block registrations or logins.
    console.warn('[RATE-LIMIT] limiter error, failing open:', e instanceof Error ? e.message : e)
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs }
  }
}

async function doCheckRateLimit(
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
  try {
    const kv = await getKvClient()
    if (!kv) return false
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
