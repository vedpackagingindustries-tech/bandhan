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
      db.directory.findMany({ where, include: { owner: { select: { profile: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.directory.count({ where }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[ADMIN DIRECTORY] Error:', err)
    return error('Failed to fetch directories')
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

    const dir = await db.directory.findUnique({ where: { id } })
    if (!dir) return error('Directory not found', 404)

    const { ipAddress, userAgent } = getClientInfo(request)
    let updated
    if (action === 'APPROVE') {
      updated = await db.directory.update({ where: { id }, data: { status: 'ACTIVE', isVerified: true, approvedAt: new Date(), approvedBy: auth.userId } })
      await createNotification({ userId: dir.ownerId, type: 'APPROVAL', title: 'Directory Listing Approved', message: `Your listing "${dir.name}" has been approved.` })
    } else if (action === 'REJECT') {
      updated = await db.directory.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason, approvedBy: auth.userId } })
    } else if (action === 'BLOCK') {
      updated = await db.directory.update({ where: { id }, data: { status: 'BLOCKED' } })
    } else {
      return error('Invalid action')
    }

    await logAudit({ userId: auth.userId, action: `admin.directory.${action.toLowerCase()}`, entity: 'Directory', entityId: id, details: { action }, ipAddress, userAgent })
    return success({ directory: updated })
  } catch (err) {
    console.error('[ADMIN DIRECTORY PUT] Error:', err)
    return error('Failed to update directory')
  }
}