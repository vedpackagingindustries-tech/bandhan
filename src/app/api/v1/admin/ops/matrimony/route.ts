// ═══════════════════════════════════════════════════════════
// MATRIMONY MODERATION API
// Super Admin only — approve, reject, block, feature profiles
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { logSecurityEvent } from '@/lib/audit'

// ─────────────────────────────────────────────
// GET — List matrimony profiles for moderation
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { auth, error: err } = await requireSuperAdmin(request)
  if (err) return err

  try {
    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const status = sp.get('status') || 'PENDING_APPROVAL'
    const gender = sp.get('gender') || undefined
    const search = sp.get('search') || undefined
    const hasPhoto = sp.get('hasPhoto')
    const isFeatured = sp.get('isFeatured')

    const where: Record<string, unknown> = { status }

    if (gender) where.gender = gender

    if (hasPhoto !== null) {
      where.profile = {
        ...((where.profile as Record<string, unknown>) || {}),
        profilePhotoUrl: hasPhoto === 'true' ? { not: null } : null,
      }
    }

    if (isFeatured !== null) {
      where.isFeatured = isFeatured === 'true'
    }

    if (search) {
      where.profile = {
        ...((where.profile as Record<string, unknown>) || {}),
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { displayName: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    }

    const [items, total] = await Promise.all([
      db.matrimonyProfile.findMany({
        where,
        include: {
          profile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              profilePhotoUrl: true,
              profileVisible: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  status: true,
                  membershipTier: true,
                  role: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.matrimonyProfile.count({ where }),
    ])

    return success({
      items,
      pagination: paginate(page, limit, total),
    })
  } catch (e) {
    console.error('[MATRIMONY_MODERATION] GET failed:', e)
    return serverError()
  }
}

// ─────────────────────────────────────────────
// POST — Moderate a matrimony profile
// ─────────────────────────────────────────────
type ModerationAction =
  | 'APPROVE'
  | 'REJECT'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'REQUEST_CORRECTION'
  | 'FEATURE'
  | 'UNFEATURE'

export async function POST(request: NextRequest) {
  const { auth, error: err } = await requireSuperAdmin(request)
  if (err) return err

  const client = getClientInfo(request)

  try {
    const body = await request.json()
    const { profileId, action, reason, featuredDays } = body as {
      profileId?: string
      action?: ModerationAction
      reason?: string
      featuredDays?: number
    }

    if (!profileId || !action) {
      return error('profileId and action are required')
    }

    const validActions: ModerationAction[] = [
      'APPROVE', 'REJECT', 'BLOCK', 'UNBLOCK', 'REQUEST_CORRECTION', 'FEATURE', 'UNFEATURE',
    ]
    if (!validActions.includes(action)) {
      return error(`Invalid action. Must be one of: ${validActions.join(', ')}`)
    }

    // Fetch the profile with relations
    const matrimonyProfile = await db.matrimonyProfile.findUnique({
      where: { id: profileId },
      include: {
        profile: {
          include: { user: true },
        },
      },
    })

    if (!matrimonyProfile) {
      return error('Matrimony profile not found', 404)
    }

    const userId = matrimonyProfile.profile.user.id
    const now = new Date()

    // ─── APPROVE ───
    if (action === 'APPROVE') {
      const wasPending = matrimonyProfile.status === 'PENDING_APPROVAL'

      await db.$transaction(async (tx) => {
        await tx.matrimonyProfile.update({
          where: { id: profileId },
          data: {
            status: 'APPROVED',
            approvedAt: now,
            approvedBy: auth.user.id,
          },
        })
        await tx.profile.update({
          where: { id: matrimonyProfile.profileId },
          data: { profileVisible: true },
        })
        if (wasPending) {
          await tx.user.update({
            where: { id: userId },
            data: { status: 'ACTIVE' },
          })
        }
      })

      // Notify user
      await db.notification.create({
        data: {
          userId,
          type: 'APPROVAL',
          title: 'Matrimony Profile Approved',
          message: 'Your matrimony profile has been approved and is now visible to other members.',
          channel: 'IN_APP',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.matrimony_approve',
        entity: 'MatrimonyProfile',
        entityId: profileId,
        details: { targetUserId: userId, previousStatus: matrimonyProfile.status },
        ...client,
      })

      return success({ message: 'Profile approved successfully' })
    }

    // ─── REJECT ───
    if (action === 'REJECT') {
      await db.matrimonyProfile.update({
        where: { id: profileId },
        data: {
          status: 'REJECTED',
          rejectedAt: now,
          rejectionReason: reason || null,
        },
      })

      // Notify user
      await db.notification.create({
        data: {
          userId,
          type: 'REJECTION',
          title: 'Matrimony Profile Rejected',
          message: reason
            ? `Your matrimony profile has been rejected. Reason: ${reason}`
            : 'Your matrimony profile has been rejected. Please update and resubmit.',
          channel: 'IN_APP',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.matrimony_reject',
        entity: 'MatrimonyProfile',
        entityId: profileId,
        details: { targetUserId: userId, reason, previousStatus: matrimonyProfile.status },
        ...client,
      })

      return success({ message: 'Profile rejected' })
    }

    // ─── BLOCK ───
    if (action === 'BLOCK') {
      await db.$transaction(async (tx) => {
        await tx.matrimonyProfile.update({
          where: { id: profileId },
          data: { status: 'BLOCKED' },
        })
        await tx.user.update({
          where: { id: userId },
          data: { status: 'BLOCKED' },
        })
      })

      await logSecurityEvent({
        userId,
        eventType: 'ACCOUNT_BLOCKED',
        description: `Matrimony profile blocked by admin ${auth.user.email}. Reason: ${reason || 'Not specified'}`,
        ...client,
        severity: 'WARNING',
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.matrimony_block',
        entity: 'MatrimonyProfile',
        entityId: profileId,
        details: { targetUserId: userId, reason },
        ...client,
      })

      return success({ message: 'Profile blocked' })
    }

    // ─── UNBLOCK ───
    if (action === 'UNBLOCK') {
      await db.$transaction(async (tx) => {
        await tx.matrimonyProfile.update({
          where: { id: profileId },
          data: { status: 'PENDING_APPROVAL' },
        })
        await tx.user.update({
          where: { id: userId },
          data: { status: 'PENDING_APPROVAL' },
        })
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.matrimony_unblock',
        entity: 'MatrimonyProfile',
        entityId: profileId,
        details: { targetUserId: userId },
        ...client,
      })

      return success({ message: 'Profile unblocked, set to pending approval' })
    }

    // ─── REQUEST_CORRECTION ───
    if (action === 'REQUEST_CORRECTION') {
      await db.matrimonyProfile.update({
        where: { id: profileId },
        data: { status: 'DRAFT' },
      })

      // Notify user
      await db.notification.create({
        data: {
          userId,
          type: 'SYSTEM',
          title: 'Matrimony Profile Needs Correction',
          message: reason
            ? `Your matrimony profile requires corrections. Reason: ${reason}`
            : 'Your matrimony profile requires corrections. Please update the necessary details and resubmit.',
          channel: 'IN_APP',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.matrimony_request_correction',
        entity: 'MatrimonyProfile',
        entityId: profileId,
        details: { targetUserId: userId, reason },
        ...client,
      })

      return success({ message: 'Correction requested' })
    }

    // ─── FEATURE ───
    if (action === 'FEATURE') {
      const days = featuredDays ?? 30
      const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

      await db.matrimonyProfile.update({
        where: { id: profileId },
        data: {
          isFeatured: true,
          featuredExpiry: expiry,
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.matrimony_feature',
        entity: 'MatrimonyProfile',
        entityId: profileId,
        details: { targetUserId: userId, featuredDays: days, expiry: expiry.toISOString() },
        ...client,
      })

      return success({ message: `Profile featured for ${days} days` })
    }

    // ─── UNFEATURE ───
    if (action === 'UNFEATURE') {
      await db.matrimonyProfile.update({
        where: { id: profileId },
        data: {
          isFeatured: false,
          featuredExpiry: null,
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.matrimony_unfeature',
        entity: 'MatrimonyProfile',
        entityId: profileId,
        details: { targetUserId: userId },
        ...client,
      })

      return success({ message: 'Profile unfeatured' })
    }

    // Should never reach here due to validation above
    return error('Unhandled action')
  } catch (e) {
    console.error('[MATRIMONY_MODERATION] POST failed:', e)
    return serverError()
  }
}
