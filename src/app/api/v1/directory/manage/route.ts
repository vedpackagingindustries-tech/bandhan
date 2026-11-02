import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams)

    const [items, total] = await Promise.all([
      db.directory.findMany({ where: { ownerId: auth.userId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.directory.count({ where: { ownerId: auth.userId } }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[DIRECTORY MANAGE GET] Error:', err)
    return error('Failed to fetch directories')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result
    const body = await request.json()
    const { id, ...data } = body
    if (!id) return error('Directory ID is required')

    const existing = await db.directory.findUnique({ where: { id } })
    if (!existing || existing.ownerId !== auth.userId) return error('Directory listing not found', 404)

    const { ipAddress, userAgent } = getClientInfo(request)
    const updated = await db.directory.update({ where: { id }, data: { ...data, status: 'PENDING' } })
    await logAudit({ userId: auth.userId, action: 'directory.update', entity: 'Directory', entityId: id, details: { fields: Object.keys(data) }, ipAddress, userAgent })
    return success({ directory: updated })
  } catch (err) {
    console.error('[DIRECTORY MANAGE PUT] Error:', err)
    return serverError('Failed to update directory')
  }
}
