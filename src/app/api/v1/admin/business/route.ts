import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const { page, limit, skip } = parsePagination(searchParams)
    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [items, total] = await Promise.all([
      db.business.findMany({ where, include: { owner: { select: { profile: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.business.count({ where }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[ADMIN BUSINESS] Error:', err)
    return error('Failed to fetch businesses')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const body = await request.json()
    const { id, action, reason } = body
    if (!id || !action) return error('ID and action required')

    const biz = await db.business.findUnique({ where: { id } })
    if (!biz) return error('Business not found', 404)

    const { ipAddress, userAgent } = getClientInfo(request)
    let updated
    if (action === 'APPROVE') {
      updated = await db.business.update({ where: { id }, data: { status: 'ACTIVE', isVerified: true, approvedAt: new Date(), approvedBy: auth.userId } })
      await createNotification({ userId: biz.ownerId, type: 'APPROVAL', title: 'Business Approved', message: `Your business "${biz.name}" has been approved.` })
    } else if (action === 'REJECT') {
      updated = await db.business.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason, approvedBy: auth.userId } })
      await createNotification({ userId: biz.ownerId, type: 'REJECTION', title: 'Business Rejected', message: reason || `Your business "${biz.name}" was not approved.` })
    } else if (action === 'BLOCK') {
      updated = await db.business.update({ where: { id }, data: { status: 'BLOCKED' } })
    } else if (action === 'VERIFY') {
      updated = await db.business.update({ where: { id }, data: { isVerified: true } })
    } else {
      return error('Invalid action')
    }

    await logAudit({ userId: auth.userId, action: `admin.business.${action.toLowerCase()}`, entity: 'Business', entityId: id, details: { action }, ipAddress, userAgent })
    return success({ business: updated })
  } catch (err) {
    console.error('[ADMIN BUSINESS PUT] Error:', err)
    return error('Failed to update business')
  }
}