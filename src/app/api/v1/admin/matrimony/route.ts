import { db } from '@/lib/db'
import { success, error, forbidden, getClientInfo } from '@/lib/api-response'
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
    const gender = searchParams.get('gender')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (gender) where.gender = gender

    const [items, total] = await Promise.all([
      db.matrimonyProfile.findMany({
        where,
        include: { profile: { select: { userId: true, firstName: true, lastName: true, gotraMaster: { select: { name: true } } } }, district: { select: { name: true } }, city: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      db.matrimonyProfile.count({ where }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[ADMIN MATRIMONY] Error:', err)
    return error('Failed to fetch matrimony profiles')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const body = await request.json()
    const { id, action, reason } = body
    if (!id || !action) return error('ID and action are required')

    const mp = await db.matrimonyProfile.findUnique({ where: { id }, include: { profile: { select: { userId: true } } } })
    if (!mp) return error('Matrimony profile not found', 404)

    const { ipAddress, userAgent } = getClientInfo(request)
    const now = new Date()
    let updated

    if (action === 'APPROVE') {
      updated = await db.matrimonyProfile.update({ where: { id }, data: { status: 'APPROVED', approvedAt: now, approvedBy: auth.userId } })
      if (mp.profile) await createNotification({ userId: mp.profile.userId, type: 'APPROVAL', title: 'Matrimony Profile Approved', message: 'Your matrimony profile has been approved.' })
    } else if (action === 'REJECT') {
      updated = await db.matrimonyProfile.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: now, rejectionReason: reason } })
      if (mp.profile) await createNotification({ userId: mp.profile.userId, type: 'REJECTION', title: 'Matrimony Profile Rejected', message: reason || 'Your matrimony profile was not approved.' })
    } else if (action === 'BLOCK') {
      updated = await db.matrimonyProfile.update({ where: { id }, data: { status: 'BLOCKED' } })
    } else if (action === 'UNBLOCK') {
      updated = await db.matrimonyProfile.update({ where: { id }, data: { status: 'DRAFT' } })
    } else {
      return error('Invalid action. Use APPROVE, REJECT, BLOCK, or UNBLOCK.')
    }

    await logAudit({ userId: auth.userId, action: `admin.matrimony.${action.toLowerCase()}`, entity: 'MatrimonyProfile', entityId: id, details: { action, reason }, ipAddress, userAgent })
    return success({ matrimonyProfile: updated })
  } catch (err) {
    console.error('[ADMIN MATRIMONY PUT] Error:', err)
    return error('Failed to update matrimony profile')
  }
}