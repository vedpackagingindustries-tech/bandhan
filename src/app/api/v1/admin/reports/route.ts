import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const targetType = searchParams.get('targetType')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (targetType) where.targetType = targetType

    const [items, total] = await Promise.all([
      db.report.findMany({
        where,
        include: { reporter: { select: { profile: { select: { firstName: true, lastName: true } } } }, reviewer: { select: { profile: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      db.report.count({ where }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[ADMIN REPORTS] Error:', err)
    return error('Failed to fetch reports')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const body = await request.json()
    const { id, action, resolution } = body
    if (!id || !action) return error('ID and action required')

    const report = await db.report.findUnique({ where: { id } })
    if (!report) return error('Report not found', 404)

    const { ipAddress, userAgent } = getClientInfo(request)
    let updated
    if (action === 'RESOLVE') {
      updated = await db.report.update({ where: { id }, data: { status: 'RESOLVED', resolution, reviewedBy: auth.userId, reviewedAt: new Date() } })
    } else if (action === 'DISMISS') {
      updated = await db.report.update({ where: { id }, data: { status: 'DISMISSED', resolution: 'Dismissed by admin', reviewedBy: auth.userId, reviewedAt: new Date() } })
    } else {
      return error('Invalid action. Use RESOLVE or DISMISS.')
    }

    await logAudit({ userId: auth.userId, action: `admin.report.${action.toLowerCase()}`, entity: 'Report', entityId: id, details: { action, resolution }, ipAddress, userAgent })
    return success({ report: updated })
  } catch (err) {
    console.error('[ADMIN REPORTS PUT] Error:', err)
    return error('Failed to update report')
  }
}
