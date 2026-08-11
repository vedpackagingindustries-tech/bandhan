import { db } from '@/lib/db'
import { unauthorized, success, error, forbidden, getClientInfo } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/admin/gotras
 * Super Admin: List all Gotras with status and profile count.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // active, inactive, all

    const where: Record<string, unknown> = {}
    if (status === 'active') where.isActive = true
    if (status === 'inactive') where.isActive = false

    const gotras = await db.gotra.findMany({
      where,
      include: { _count: { select: { profiles: true } } },
      orderBy: { name: 'asc' },
    })

    const total = await db.gotra.count()
    const activeCount = await db.gotra.count({ where: { isActive: true } })
    const inactiveCount = total - activeCount

    return success({ gotras, total, activeCount, inactiveCount })
  } catch (err) {
    console.error('[ADMIN GOTRAS GET] Error:', err)
    return error('Failed to fetch Gotras')
  }
}

/**
 * PUT /api/v1/admin/gotras
 * Super Admin: Activate/deactivate a Gotra.
 * Body: { gotraId: string, isActive: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    if (!auth.user.role || auth.user.role.name !== 'SUPER_ADMIN') {
      return forbidden('Only Super Admin can manage Gotras')
    }

    const body = await request.json()
    const { gotraId, isActive } = body

    if (!gotraId || typeof isActive !== 'boolean') {
      return error('gotraId (string) and isActive (boolean) are required')
    }

    const existing = await db.gotra.findUnique({ where: { id: gotraId } })
    if (!existing) return error('Gotra not found', 404)

    const updated = await db.gotra.update({
      where: { id: gotraId },
      data: { isActive },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'admin.gotra_toggle',
      entity: 'Gotra',
      entityId: gotraId,
      details: { name: existing.name, isActive },
      ipAddress,
      userAgent,
    })

    return success({ gotra: updated })
  } catch (err) {
    console.error('[ADMIN GOTRAS PUT] Error:', err)
    return error('Failed to update Gotra')
  }
}
