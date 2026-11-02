// ═══════════════════════════════════════════════════════════
// BUSINESS MODERATION API
// Super Admin only — approve, reject, block, verify, feature businesses
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'

// ─────────────────────────────────────────────
// GET — List businesses for moderation
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { auth, error: err } = await requireSuperAdmin(request)
  if (err) return err

  try {
    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const status = sp.get('status') || 'PENDING'
    const category = sp.get('category') || undefined
    const search = sp.get('search') || undefined
    const isVerified = sp.get('isVerified')
    const isFeatured = sp.get('isFeatured')

    const where: Record<string, unknown> = { status }

    if (category) where.category = category
    if (isVerified !== null) {
      where.isVerified = isVerified === 'true'
    }
    if (isFeatured !== null) {
      where.isFeatured = isFeatured === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { owner: { profile: { displayName: { contains: search, mode: 'insensitive' as const } } } },
      ]
    }

    const [items, total] = await Promise.all([
      db.business.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.business.count({ where }),
    ])

    return success({
      items,
      pagination: paginate(page, limit, total),
    })
  } catch (e) {
    console.error('[BUSINESS_MODERATION] GET failed:', e)
    return serverError()
  }
}

// ─────────────────────────────────────────────
// POST — Moderate a business
// ─────────────────────────────────────────────
type ModerationAction =
  | 'APPROVE'
  | 'REJECT'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'VERIFY'
  | 'UNVERIFY'
  | 'FEATURE'
  | 'UNFEATURE'

export async function POST(request: NextRequest) {
  const { auth, error: err } = await requireSuperAdmin(request)
  if (err) return err

  const client = getClientInfo(request)

  try {
    const body = await request.json()
    const { businessId, action, reason, featuredDays } = body as {
      businessId?: string
      action?: ModerationAction
      reason?: string
      featuredDays?: number
    }

    if (!businessId || !action) {
      return error('businessId and action are required')
    }

    const validActions: ModerationAction[] = [
      'APPROVE', 'REJECT', 'BLOCK', 'UNBLOCK', 'VERIFY', 'UNVERIFY', 'FEATURE', 'UNFEATURE',
    ]
    if (!validActions.includes(action)) {
      return error(`Invalid action. Must be one of: ${validActions.join(', ')}`)
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      return error('Business not found', 404)
    }

    const now = new Date()

    // ─── APPROVE ───
    if (action === 'APPROVE') {
      await db.business.update({
        where: { id: businessId },
        data: {
          status: 'ACTIVE',
          approvedAt: now,
          approvedBy: auth.user.id,
        },
      })

      await db.notification.create({
        data: {
          userId: business.ownerId,
          type: 'APPROVAL',
          title: 'Business Approved',
          message: `Your business "${business.name}" has been approved and is now live.`,
          channel: 'IN_APP',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.business_approve',
        entity: 'Business',
        entityId: businessId,
        details: { targetUserId: business.ownerId, businessName: business.name, previousStatus: business.status },
        ...client,
      })

      return success({ message: 'Business approved' })
    }

    // ─── REJECT ───
    if (action === 'REJECT') {
      await db.business.update({
        where: { id: businessId },
        data: {
          status: 'REJECTED',
          rejectedAt: now,
          rejectionReason: reason || null,
        },
      })

      await db.notification.create({
        data: {
          userId: business.ownerId,
          type: 'REJECTION',
          title: 'Business Rejected',
          message: reason
            ? `Your business "${business.name}" has been rejected. Reason: ${reason}`
            : `Your business "${business.name}" has been rejected. Please review and resubmit.`,
          channel: 'IN_APP',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.business_reject',
        entity: 'Business',
        entityId: businessId,
        details: { targetUserId: business.ownerId, reason, previousStatus: business.status },
        ...client,
      })

      return success({ message: 'Business rejected' })
    }

    // ─── BLOCK ───
    if (action === 'BLOCK') {
      await db.business.update({
        where: { id: businessId },
        data: { status: 'BLOCKED' },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.business_block',
        entity: 'Business',
        entityId: businessId,
        details: { targetUserId: business.ownerId, reason },
        ...client,
      })

      return success({ message: 'Business blocked' })
    }

    // ─── UNBLOCK ───
    if (action === 'UNBLOCK') {
      await db.business.update({
        where: { id: businessId },
        data: { status: 'PENDING' },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.business_unblock',
        entity: 'Business',
        entityId: businessId,
        details: { targetUserId: business.ownerId },
        ...client,
      })

      return success({ message: 'Business unblocked, set to pending' })
    }

    // ─── VERIFY ───
    if (action === 'VERIFY') {
      await db.business.update({
        where: { id: businessId },
        data: { isVerified: true },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.business_verify',
        entity: 'Business',
        entityId: businessId,
        details: { targetUserId: business.ownerId, businessName: business.name },
        ...client,
      })

      return success({ message: 'Business verified' })
    }

    // ─── UNVERIFY ───
    if (action === 'UNVERIFY') {
      await db.business.update({
        where: { id: businessId },
        data: { isVerified: false },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.business_unverify',
        entity: 'Business',
        entityId: businessId,
        details: { targetUserId: business.ownerId },
        ...client,
      })

      return success({ message: 'Business verification removed' })
    }

    // ─── FEATURE ───
    if (action === 'FEATURE') {
      const days = featuredDays ?? 30
      const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

      await db.business.update({
        where: { id: businessId },
        data: {
          isFeatured: true,
          featuredExpiry: expiry,
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.business_feature',
        entity: 'Business',
        entityId: businessId,
        details: { targetUserId: business.ownerId, featuredDays: days, expiry: expiry.toISOString() },
        ...client,
      })

      return success({ message: `Business featured for ${days} days` })
    }

    // ─── UNFEATURE ───
    if (action === 'UNFEATURE') {
      await db.business.update({
        where: { id: businessId },
        data: {
          isFeatured: false,
          featuredExpiry: null,
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.business_unfeature',
        entity: 'Business',
        entityId: businessId,
        details: { targetUserId: business.ownerId },
        ...client,
      })

      return success({ message: 'Business unfeatured' })
    }

    return error('Unhandled action')
  } catch (e) {
    console.error('[BUSINESS_MODERATION] POST failed:', e)
    return serverError()
  }
}
