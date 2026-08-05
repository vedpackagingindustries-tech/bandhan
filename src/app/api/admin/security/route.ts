'use server'

import { db } from '@/lib/db'
import { unauthorized, success, error, isAdmin } from '@/lib/api-response'
import { NextRequest } from 'next/server'

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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.securityEvent.count({ where }),
    ])

    // Severity counts
    const criticalCount = await db.securityEvent.count({ where: { severity: 'CRITICAL' } })
    const warningCount = await db.securityEvent.count({ where: { severity: 'WARNING' } })

    return success({
      events,
      summary: { critical: criticalCount, warning: warningCount },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[ADMIN SECURITY] Error:', err)
    return error('Failed to fetch security events')
  }
}
