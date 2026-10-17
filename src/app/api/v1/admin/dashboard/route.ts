import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/admin/dashboard — Dashboard statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    // Run all counts in parallel for speed
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      blockedUsers,
      totalProfiles,
      totalJobs,
      activeJobs,
      totalBusinesses,
      totalDirectories,
      totalContactRequests,
      pendingContactRequests,
      totalNotifications,
      unreadNotifications,
      premiumMembers,
      eliteMembers,
      recentLogins,
      securityEventsToday,
    ] = await Promise.all([
      // User stats
      db.user.count(),
      db.user.count({ where: { status: 'ACTIVE' } }),
      db.user.count({ where: { status: 'PENDING_APPROVAL' } }),
      db.user.count({ where: { status: 'BLOCKED' } }),
      // Content stats
      db.profile.count(),
      db.job.count(),
      db.job.count({ where: { status: 'ACTIVE' } }),
      db.business.count(),
      db.directory.count(),
      // Contact requests
      db.contactRequest.count(),
      db.contactRequest.count({ where: { status: 'PENDING' } }),
      // Notifications
      db.notification.count(),
      db.notification.count({ where: { read: false } }),
      // Membership
      db.user.count({ where: { membershipTier: 'PREMIUM' } }),
      db.user.count({ where: { membershipTier: 'ELITE' } }),
      // Recent activity (last 24 hours)
      db.loginHistory.count({
        where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
      }),
      db.securityEvent.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 86400000) },
          severity: { in: ['WARNING', 'CRITICAL'] },
        },
      }),
    ])

    // Get registration trend (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    const recentRegistrations = await db.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Group by day
    const registrationTrend: Record<string, number> = {}
    for (const reg of recentRegistrations) {
      const day = reg.createdAt.toISOString().split('T')[0]
      registrationTrend[day] = (registrationTrend[day] || 0) + 1
    }

    // Gender distribution
    const maleProfiles = await db.profile.count({ where: { gender: 'MALE' } })
    const femaleProfiles = await db.profile.count({ where: { gender: 'FEMALE' } })

    return success({
      users: {
        total: totalUsers,
        active: activeUsers,
        pending: pendingUsers,
        blocked: blockedUsers,
      },
      content: {
        profiles: totalProfiles,
        jobs: totalJobs,
        activeJobs,
        businesses: totalBusinesses,
        directories: totalDirectories,
      },
      contactRequests: {
        total: totalContactRequests,
        pending: pendingContactRequests,
      },
      notifications: {
        total: totalNotifications,
        unread: unreadNotifications,
      },
      membership: {
        premium: premiumMembers,
        elite: eliteMembers,
        free: totalUsers - premiumMembers - eliteMembers,
      },
      activity: {
        recentLogins24h: recentLogins,
        securityEvents24h: securityEventsToday,
      },
      demographics: {
        male: maleProfiles,
        female: femaleProfiles,
      },
      registrationTrend,
    })
  } catch (err) {
    console.error('[ADMIN DASHBOARD] Error:', err)
    return error('Failed to fetch dashboard stats')
  }
}
