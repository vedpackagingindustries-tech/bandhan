import { db } from '@/lib/db'
import { unauthorized, success, error, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams, { page: 1, limit: 50 })
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [memberships, total] = await Promise.all([
      db.membership.findMany({
        where,
        include: {
          user: {
            select: {
              id: true, email: true, phone: true, status: true, membershipTier: true,
              profile: { select: { firstName: true, lastName: true, displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.membership.count({ where }),
    ])

    // Also return plan definitions
    const plans = await db.membershipPlan.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
    })

    return success({ memberships, plans, pagination: paginate(page, limit, total) })
  } catch (err) {
    console.error('[MEMBERSHIP] Error:', err)
    return error('Failed to fetch memberships')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { userId, tier, durationDays, paymentMethod, paymentRef, amount } = body

    if (!userId || !tier) return error('User ID and tier are required')

    const validTiers = ['FREE', 'PREMIUM', 'ELITE']
    if (!validTiers.includes(tier)) return error('Invalid tier')

    // Deactivate existing memberships
    await db.membership.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'EXPIRED', updatedAt: new Date() },
    })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (durationDays || 30))

    const membership = await db.membership.create({
      data: {
        userId,
        tier,
        status: 'ACTIVE',
        expiresAt,
        paymentMethod: paymentMethod || null,
        paymentRef: paymentRef || null,
        amount: amount || 0,
      },
    })

    // Update user tier
    await db.user.update({
      where: { id: userId },
      data: { membershipTier: tier },
    })

    const { createNotification } = await import('@/lib/notification')
    await createNotification({
      userId,
      type: 'MEMBERSHIP',
      title: 'Membership Updated',
      message: `Your membership has been upgraded to ${tier}.`,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'admin.membership_update',
      entity: 'Membership',
      entityId: membership.id,
      details: { targetUserId: userId, tier, durationDays },
      ipAddress,
      userAgent,
    })

    return success({ membership }, 201)
  } catch (err) {
    console.error('[MEMBERSHIP CREATE] Error:', err)
    return error('Failed to create membership')
  }
}
