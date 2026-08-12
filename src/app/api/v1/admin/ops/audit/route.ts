import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit, verifyAuditIntegrity } from '@/lib/audit'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════
// GET — Search and filter audit logs (READ-ONLY / IMMUTABLE)
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp, { page: 1, limit: 50 })

    const userId = sp.get('userId')
    const action = sp.get('action')
    const entity = sp.get('entity')
    const entityId = sp.get('entityId')
    const startDateStr = sp.get('startDate')
    const endDateStr = sp.get('endDate')

    // Default last 7 days
    const now = new Date()
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startDate = startDateStr ? new Date(startDateStr) : defaultStart
    const endDate = endDateStr ? new Date(endDateStr) : now

    // Build where clause
    const where: Record<string, unknown> = {
      createdAt: { gte: startDate, lte: endDate },
    }

    if (userId) where.userId = userId
    if (action) where.action = { contains: action }
    if (entity) where.entity = entity
    if (entityId) where.entityId = entityId

    // Fetch logs, integrity check, and action stats in parallel
    const [logs, total, integrity, actionStats] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      db.auditLog.count({ where }),
      verifyAuditIntegrity(),
      // Top 20 actions grouped
      db.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 20,
      }),
    ])

    return success({
      logs: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.user?.profile?.displayName ?? log.user?.email ?? null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        details: log.details ? JSON.parse(log.details) : null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: paginate(page, limit, total),
      stats: {
        totalMatching: total,
        byAction: actionStats.map((s) => ({
          action: s.action,
          count: s._count.action,
        })),
      },
      integrity,
    })
  } catch (err) {
    console.error('[AUDIT_CENTER] GET error:', err)
    return serverError('Failed to retrieve audit logs')
  }
}
