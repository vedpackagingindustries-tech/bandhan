import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'

/** GET /api/v1/membership/plans — Public plans (configurable pricing) */
export async function GET() {
  try {
    const plans = await db.membershipPlan.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
    })
    return success({ plans })
  } catch (err) {
    console.error('[MEMBERSHIP PLANS] Error:', err)
    return error('Failed to fetch plans')
  }
}
