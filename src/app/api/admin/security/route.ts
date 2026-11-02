import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams, { page: 1, limit: 50 })
    const severity = searchParams.get('severity')
    const eventType = searchParams.get('eventType')

    const where: Record<string, unknown> = {}
    if (severity) where.severity = severity
    if (eventType) where.eventType = eventType

    const [events, total] = await Promise.all([
      db.securityEvent.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.securityEvent.count({ where }),
    ])

    const [criticalCount, warningCount] = await Promise.all([
      db.securityEvent.count({ where: { severity: 'CRITICAL' } }),
      db.securityEvent.count({ where: { severity: 'WARNING' } }),
    ])

    return success({
      events,
      summary: { critical: criticalCount, warning: warningCount },
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[ADMIN SECURITY] Error:', err)
    return error('Failed to fetch security events')
  }
}
