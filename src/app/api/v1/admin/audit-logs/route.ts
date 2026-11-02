import { db } from '@/lib/db'
import { unauthorized, success, error } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams, { page: 1, limit: 50 })
    const action = searchParams.get('action')
    const entity = searchParams.get('entity')
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}
    if (action) where.action = { contains: action }
    if (entity) where.entity = entity
    if (userId) where.userId = userId
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate)
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate)
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true, displayName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    // Action breakdown for analytics
    const actionBreakdown = await db.auditLog.groupBy({
      by: ['action'],
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    })

    return success({
      logs,
      actionBreakdown,
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[AUDIT LOGS] Error:', err)
    return error('Failed to fetch audit logs')
  }
}
