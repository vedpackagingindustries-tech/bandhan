import { db } from '@/lib/db'
import { success } from '@/lib/api-response'
import { getCache, setCache } from '@/services/cache'

/**
 * GET /api/v1/stats/public
 * Returns public community statistics (no auth required).
 */
export async function GET() {
  try {
    const cacheKey = 'public-community-stats'
    const cached = getCache(cacheKey)
    if (cached) return success(cached)

    const [totalUsers, activeUsers, byCategory] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: 'ACTIVE' } }),
      db.user.groupBy({
        by: ['registrationCategory'],
        _count: true,
      }),
    ])

    const data = {
      totalMembers: totalUsers,
      activeUsers,
      byCategory: byCategory.map((c) => ({
        registrationCategory: c.registrationCategory,
        _count: c._count,
      })),
    }

    setCache(cacheKey, data, 60 * 1000)
    return success(data)
  } catch (err) {
    console.error('[STATS PUBLIC] Error:', err)
    return success({ totalMembers: 0, activeUsers: 0, byCategory: [] })
  }
}
