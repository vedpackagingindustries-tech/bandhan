import { db } from '@/lib/db'
import { success } from '@/lib/api-response'
import { getCache, setCache } from '@/services/cache'

/** GET /api/v1/stats/public — Real backend community metrics */
export async function GET() {
  try {
    const cacheKey = 'public-community-stats'
    const cached = getCache(cacheKey)
    if (cached) return success(cached)

    const [
      totalUsers, activeUsers,
      approvedMatrimony, activeJobs, activeBusiness, activeDirectory,
    ] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      db.matrimonyProfile.count({ where: { status: 'APPROVED' } }),
      db.job.count({ where: { status: 'ACTIVE' } }),
      db.business.count({ where: { status: 'ACTIVE' } }),
      db.directory.count({ where: { status: 'ACTIVE' } }),
    ])

    const data = {
      totalMembers: totalUsers,
      activeUsers,
      matrimonyProfiles: approvedMatrimony,
      activeJobs,
      activeBusiness,
      activeDirectory,
    }

    setCache(cacheKey, data, 60 * 1000)
    return success(data)
  } catch (err) {
    console.error('[STATS PUBLIC] Error:', err)
    return success({ totalMembers: 0, activeUsers: 0, matrimonyProfiles: 0, activeJobs: 0, activeBusiness: 0, activeDirectory: 0 })
  }
}
