import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/** GET /api/v1/business/manage — List own businesses */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams)

    const [items, total] = await Promise.all([
      db.business.findMany({ where: { ownerId: auth.userId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.business.count({ where: { ownerId: auth.userId } }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[BUSINESS MANAGE GET] Error:', err)
    return error('Failed to fetch businesses')
  }
}

/** PUT /api/v1/business/manage — Update own business */
export async function PUT(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result
    const body = await request.json()
    const { id, ...data } = body
    if (!id) return error('Business ID is required')

    const existing = await db.business.findUnique({ where: { id } })
    if (!existing || existing.ownerId !== auth.userId) return error('Business not found', 404)
    if (existing.status === 'BLOCKED') return error('Cannot edit blocked business')

    if (data.services) data.services = JSON.stringify(data.services)
    if (data.workingHours) data.workingHours = JSON.stringify(data.workingHours)

    const { ipAddress, userAgent } = getClientInfo(request)
    const updated = await db.business.update({ where: { id }, data: { ...data, status: 'PENDING' } })
    await logAudit({ userId: auth.userId, action: 'business.update', entity: 'Business', entityId: id, details: { fields: Object.keys(data) }, ipAddress, userAgent })

    return success({ business: updated })
  } catch (err) {
    console.error('[BUSINESS MANAGE PUT] Error:', err)
    return serverError('Failed to update business')
  }
}
