import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '365d' ? 365 : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Admin role ID filter
    const adminRole = await db.role.findUnique({ where: { name: 'SUPER_ADMIN' } })
    const adminWhere = {
      createdAt: { gte: startDate },
      ...(adminRole ? { NOT: { roleId: adminRole.id } } : {}),
    }

    const [
      categoryBreakdown,
      tierBreakdown,
      statusBreakdown,
      registrationTrend,
      approvalStats,
      securitySummary,
      recentActivity,
    ] = await Promise.all([
      db.user.groupBy({
        by: ['registrationCategory'],
        where: adminWhere,
        _count: true,
      }),
      db.user.groupBy({
        by: ['membershipTier'],
        where: adminWhere,
        _count: true,
      }),
      db.user.groupBy({
        by: ['status'],
        _count: true,
      }),
      db.user.count({ where: adminWhere }),
      db.approval.groupBy({
        by: ['status'],
        _count: true,
      }),
      db.securityEvent.groupBy({
        by: ['severity'],
        _count: true,
      }),
      db.auditLog.findMany({
        include: { user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    return success({
      period,
      startDate: startDate.toISOString(),
      totalRegistrationsInPeriod: registrationTrend,
      breakdown: {
        category: categoryBreakdown,
        tier: tierBreakdown,
        status: statusBreakdown,
      },
      approvals: approvalStats,
      security: securitySummary,
      recentActivity,
    })
  } catch (err) {
    console.error('[ANALYTICS] Error:', err)
    return error('Failed to fetch analytics')
  }
}
