import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { generateMonthlyShowcase, currentMonthKey, expireOldShowcase } from '@/lib/showcase'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// GET    /api/v1/admin/showcase — preview current/upcoming selections
// POST   /api/v1/admin/showcase — (re)generate monthly top-10 (admin approval flow)
// PATCH  /api/v1/admin/showcase — remove/schedule an item (admin override)
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const monthKey = sp.get('monthKey') || currentMonthKey()
    await expireOldShowcase()

    const items = await db.premiumShowcase.findMany({
      where: { monthKey },
      orderBy: [{ module: 'asc' }, { rank: 'asc' }],
    })
    return success({ monthKey, items })
  } catch (err) {
    console.error('[ADMIN SHOWCASE GET] Error:', err)
    return serverError('Failed to load showcase')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json().catch(() => ({}))
    const monthKey = (body as { monthKey?: string }).monthKey || currentMonthKey()

    const generated = await generateMonthlyShowcase(monthKey)

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'showcase.generated',
      entity: 'PremiumShowcase',
      entityId: monthKey,
      details: generated,
      ipAddress,
      userAgent,
    })

    return success({
      monthKey,
      generated,
      message: 'Showcase generated from real approved premium listings. Review the selections below.',
    })
  } catch (err) {
    console.error('[ADMIN SHOWCASE POST] Error:', err)
    return serverError('Failed to generate showcase')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { id, action } = body as { id?: string; action?: 'REMOVE' | 'APPROVE' }
    if (!id || !action || !['REMOVE', 'APPROVE'].includes(action)) {
      return error('id and action (REMOVE | APPROVE) are required')
    }

    const item = await db.premiumShowcase.findUnique({ where: { id } })
    if (!item) return error('Showcase item not found', 404)

    if (action === 'REMOVE') {
      await db.premiumShowcase.delete({ where: { id } })
    } else {
      await db.premiumShowcase.update({
        where: { id },
        data: { status: 'APPROVED', selectedBy: auth.userId },
      })
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: `showcase.${action.toLowerCase()}`,
      entity: 'PremiumShowcase',
      entityId: id,
      details: { module: item.module, listingId: item.listingId },
      ipAddress,
      userAgent,
    })

    return success({ message: `Showcase item ${action === 'REMOVE' ? 'removed' : 'approved'}` })
  } catch (err) {
    console.error('[ADMIN SHOWCASE PATCH] Error:', err)
    return serverError('Failed to update showcase')
  }
}
