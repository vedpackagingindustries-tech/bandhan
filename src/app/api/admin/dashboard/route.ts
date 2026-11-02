import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

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
      db.user.findMany({
        where: { role: { name: { not: 'SUPER_ADMIN' } } },
        include: {
          profile: { select: { firstName: true, lastName: true, displayName: true } },
          role: { select: { name: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.user.groupBy({
        by: ['registrationCategory'],
        where: { role: { name: { not: 'SUPER_ADMIN' } } },
        _count: true,
      }),
      db.user.groupBy({
        by: ['membershipTier'],
        where: { role: { name: { not: 'SUPER_ADMIN' } } },
        _count: true,
      }),
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
