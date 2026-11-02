// ═══════════════════════════════════════════════════════════
// DIRECTORY MANAGEMENT API
// Super Admin only — approve, reject, block, verify, feature directory entries
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'

// ─────────────────────────────────────────────
// GET — List directory entries
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { auth, error: err } = await requireSuperAdmin(request)
  if (err) return err

  try {
    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const status = sp.get('status') || undefined
    const category = sp.get('category') || undefined
    const search = sp.get('search') || undefined
    const isVerified = sp.get('isVerified')
    const isFeatured = sp.get('isFeatured')

    const where: Record<string, unknown> = {}

    if (status) where.status = status
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
      db.directory.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.directory.count({ where }),
    ])

    return success({
      items,
      pagination: paginate(page, limit, total),
    })
  } catch (e) {
    console.error('[DIRECTORY_MODERATION] GET failed:', e)
    return serverError()
  }
}

// ─────────────────────────────────────────────
// POST — Manage a directory entry
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
    const { directoryId, action, reason, featuredDays } = body as {
      directoryId?: string
      action?: ModerationAction
      reason?: string
      featuredDays?: number
    }

    if (!directoryId || !action) {
      return error('directoryId and action are required')
    }

    const validActions: ModerationAction[] = [
      'APPROVE', 'REJECT', 'BLOCK', 'UNBLOCK', 'VERIFY', 'UNVERIFY', 'FEATURE', 'UNFEATURE',
    ]
    if (!validActions.includes(action)) {
      return error(`Invalid action. Must be one of: ${validActions.join(', ')}`)
    }

    const entry = await db.directory.findUnique({
      where: { id: directoryId },
    })

    if (!entry) {
      return error('Directory entry not found', 404)
    }

    const now = new Date()

    // ─── APPROVE ───
    if (action === 'APPROVE') {
      await db.directory.update({
        where: { id: directoryId },
        data: {
          status: 'ACTIVE',
          approvedAt: now,
          approvedBy: auth.user.id,
        },
      })

      await db.notification.create({
        data: {
          userId: entry.ownerId,
          type: 'APPROVAL',
          title: 'Directory Entry Approved',
          message: `Your directory entry "${entry.name}" has been approved and is now live.`,
          channel: 'IN_APP',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.directory_approve',
        entity: 'Directory',
        entityId: directoryId,
        details: { targetUserId: entry.ownerId, entryName: entry.name, previousStatus: entry.status },
        ...client,
      })

      return success({ message: 'Directory entry approved' })
    }

    // ─── REJECT ───
    if (action === 'REJECT') {
      await db.directory.update({
        where: { id: directoryId },
        data: {
          status: 'REJECTED',
          rejectedAt: now,
          rejectionReason: reason || null,
        },
      })

      await db.notification.create({
        data: {
          userId: entry.ownerId,
          type: 'REJECTION',
          title: 'Directory Entry Rejected',
          message: reason
            ? `Your directory entry "${entry.name}" has been rejected. Reason: ${reason}`
            : `Your directory entry "${entry.name}" has been rejected. Please review and resubmit.`,
          channel: 'IN_APP',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.directory_reject',
        entity: 'Directory',
        entityId: directoryId,
        details: { targetUserId: entry.ownerId, reason, previousStatus: entry.status },
        ...client,
      })

      return success({ message: 'Directory entry rejected' })
    }

    // ─── BLOCK ───
    if (action === 'BLOCK') {
      await db.directory.update({
        where: { id: directoryId },
        data: { status: 'BLOCKED' },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.directory_block',
        entity: 'Directory',
        entityId: directoryId,
        details: { targetUserId: entry.ownerId, reason },
        ...client,
      })

      return success({ message: 'Directory entry blocked' })
    }

    // ─── UNBLOCK ───
    if (action === 'UNBLOCK') {
      await db.directory.update({
        where: { id: directoryId },
        data: { status: 'PENDING' },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.directory_unblock',
        entity: 'Directory',
        entityId: directoryId,
        details: { targetUserId: entry.ownerId },
        ...client,
      })

      return success({ message: 'Directory entry unblocked, set to pending' })
    }

    // ─── VERIFY ───
    if (action === 'VERIFY') {
      await db.directory.update({
        where: { id: directoryId },
        data: { isVerified: true },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.directory_verify',
        entity: 'Directory',
        entityId: directoryId,
        details: { targetUserId: entry.ownerId, entryName: entry.name },
        ...client,
      })

      return success({ message: 'Directory entry verified' })
    }

    // ─── UNVERIFY ───
    if (action === 'UNVERIFY') {
      await db.directory.update({
        where: { id: directoryId },
        data: { isVerified: false },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.directory_unverify',
        entity: 'Directory',
        entityId: directoryId,
        details: { targetUserId: entry.ownerId },
        ...client,
      })

      return success({ message: 'Directory verification removed' })
    }

    // ─── FEATURE ───
    if (action === 'FEATURE') {
      const days = featuredDays ?? 30
      const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

      await db.directory.update({
        where: { id: directoryId },
        data: {
          isFeatured: true,
          featuredExpiry: expiry,
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.directory_feature',
        entity: 'Directory',
        entityId: directoryId,
        details: { targetUserId: entry.ownerId, featuredDays: days, expiry: expiry.toISOString() },
        ...client,
      })

      return success({ message: `Directory entry featured for ${days} days` })
    }

    // ─── UNFEATURE ───
    if (action === 'UNFEATURE') {
      await db.directory.update({
        where: { id: directoryId },
        data: {
          isFeatured: false,
          featuredExpiry: null,
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.directory_unfeature',
        entity: 'Directory',
        entityId: directoryId,
        details: { targetUserId: entry.ownerId },
        ...client,
      })

      return success({ message: 'Directory entry unfeatured' })
    }

    return error('Unhandled action')
  } catch (e) {
    console.error('[DIRECTORY_MODERATION] POST failed:', e)
    return serverError()
  }
}
