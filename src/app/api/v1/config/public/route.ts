import { db } from '@/lib/db'
import { success } from '@/lib/api-response'
import { getCache, setCache } from '@/services/cache'
import { CACHE_KEYS } from '@/services/cache'

/**
 * GET /api/v1/config/public
 * Returns public system configuration (no auth required).
 */
export async function GET() {
  try {
    const cached = getCache(CACHE_KEYS.PUBLIC_CONFIG)
    if (cached) return success(cached)

    const configs = await db.systemConfiguration.findMany({
      where: { isPublic: true },
      select: { key: true, value: true },
    })

    const publicConfig: Record<string, string> = {}
    for (const c of configs) {
      publicConfig[c.key] = c.value
    }

    setCache(CACHE_KEYS.PUBLIC_CONFIG, publicConfig, 5 * 60 * 1000)
    return success(publicConfig)
  } catch (err) {
    console.error('[CONFIG PUBLIC] Error:', err)
    return success({})
  }
}
