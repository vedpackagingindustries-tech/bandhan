
import { db } from '@/lib/db'
import { unauthorized, success, error, isAdmin } from '@/lib/api-response'
import { NextRequest } from 'next/server'
import { isSuperAdmin } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({
      where: { token },
      include: { user: { include: { role: true } } },
    })

    if (!session || session.expiresAt < new Date()) return unauthorized()
    if (!isAdmin(session.user.role?.name)) return error('Admin access required', 403)

    // Run all count queries in parallel
    const [
      totalUsers,
      activeUsers,
      pendingApprovals,
      premiumMembers,
      eliteMembers,
      blockedUsers,
      rejectedUsers,
      totalContactRequests,
      activeAdvertisements,
      recentUsers,
      usersByCategory,
      usersByTier,
      usersByStatus,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: 'ACTIVE' } }),
      db.user.count({ where: { status: 'PENDING_APPROVAL' } }),
      db.user.count({ where: { membershipTier: 'PREMIUM', status: 'ACTIVE' } }),
      db.user.count({ where: { membershipTier: 'ELITE', status: 'ACTIVE' } }),
      db.user.count({ where: { status: 'BLOCKED' } }),
      db.user.count({ where: { status: 'REJECTED' } }),
      db.contactRequest.count(),
      db.advertisement.count({ where: { status: 'ACTIVE' } }),
      // Last 10 registered users
      db.user.findMany({
        where: { role: { name: { not: 'SUPER_ADMIN' } } },
        include: {
          profile: { select: { firstName: true, lastName: true, displayName: true } },
          role: { select: { name: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Group by category
      db.user.groupBy({
        by: ['registrationCategory'],
        where: { role: { name: { not: 'SUPER_ADMIN' } } },
        _count: true,
      }),
      // Group by tier
      db.user.groupBy({
        by: ['membershipTier'],
        where: { role: { name: { not: 'SUPER_ADMIN' } } },
        _count: true,
      }),
      // Group by status
      db.user.groupBy({
        by: ['status'],
        where: { role: { name: { not: 'SUPER_ADMIN' } } },
        _count: true,
      }),
    ])

    return success({
      analytics: {
        totalUsers,
        activeUsers,
        pendingApprovals,
        premiumMembers,
        eliteMembers,
        blockedUsers,
        rejectedUsers,
        totalContactRequests,
        activeAdvertisements,
      },
      recentUsers,
      breakdown: {
        byCategory: usersByCategory,
        byTier: usersByTier,
        byStatus: usersByStatus,
      },
    })
  } catch (err) {
    console.error('[ADMIN DASHBOARD] Error:', err)
    return error('Failed to load dashboard')
  }
}
