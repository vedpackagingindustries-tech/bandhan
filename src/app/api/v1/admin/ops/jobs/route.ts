// ═══════════════════════════════════════════════════════════
// JOB MODERATION API
// Super Admin only — approve, reject, close, feature jobs
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'

// ─────────────────────────────────────────────
// GET — List jobs for moderation
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
    const employerId = sp.get('employerId') || undefined
    const isFeatured = sp.get('isFeatured')

    const where: Record<string, unknown> = { status }

    if (category) where.category = category
    if (employerId) where.employerId = employerId
    if (isFeatured !== null) {
      where.isFeatured = isFeatured === 'true'
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { employer: { profile: { displayName: { contains: search, mode: 'insensitive' as const } } } },
      ]
    }

    const [items, total] = await Promise.all([
      db.job.findMany({
        where,
        include: {
          employer: {
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
      db.job.count({ where }),
    ])

    return success({
      items,
      pagination: paginate(page, limit, total),
    })
  } catch (e) {
    console.error('[JOB_MODERATION] GET failed:', e)
    return serverError()
  }
}

// ─────────────────────────────────────────────
// POST — Moderate a job
// ─────────────────────────────────────────────
type ModerationAction =
  | 'APPROVE'
  | 'REJECT'
  | 'CLOSE'
  | 'FEATURE'
  | 'UNFEATURE'

export async function POST(request: NextRequest) {
  const { auth, error: err } = await requireSuperAdmin(request)
  if (err) return err

  const client = getClientInfo(request)

  try {
    const body = await request.json()
    const { jobId, action, reason, featuredDays } = body as {
      jobId?: string
      action?: ModerationAction
      reason?: string
      featuredDays?: number
    }

    if (!jobId || !action) {
      return error('jobId and action are required')
    }

    const validActions: ModerationAction[] = [
      'APPROVE', 'REJECT', 'CLOSE', 'FEATURE', 'UNFEATURE',
    ]
    if (!validActions.includes(action)) {
      return error(`Invalid action. Must be one of: ${validActions.join(', ')}`)
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return error('Job not found', 404)
    }

    const now = new Date()

    // ─── APPROVE ───
    if (action === 'APPROVE') {
      await db.job.update({
        where: { id: jobId },
        data: {
          status: 'ACTIVE',
          approvedAt: now,
          approvedBy: auth.user.id,
        },
      })

      await db.notification.create({
        data: {
          userId: job.employerId,
          type: 'APPROVAL',
          title: 'Job Listing Approved',
          message: `Your job listing "${job.title}" has been approved and is now live.`,
          channel: 'IN_APP',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.job_approve',
        entity: 'Job',
        entityId: jobId,
        details: { employerId: job.employerId, jobTitle: job.title, previousStatus: job.status },
        ...client,
      })

      return success({ message: 'Job approved' })
    }

    // ─── REJECT ───
    if (action === 'REJECT') {
      await db.job.update({
        where: { id: jobId },
        data: {
          status: 'REJECTED',
          rejectedAt: now,
          rejectionReason: reason || null,
        },
      })

      await db.notification.create({
        data: {
          userId: job.employerId,
          type: 'REJECTION',
          title: 'Job Listing Rejected',
          message: reason
            ? `Your job listing "${job.title}" has been rejected. Reason: ${reason}`
            : `Your job listing "${job.title}" has been rejected. Please review and resubmit.`,
          channel: 'IN_APP',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.job_reject',
        entity: 'Job',
        entityId: jobId,
        details: { employerId: job.employerId, reason, previousStatus: job.status },
        ...client,
      })

      return success({ message: 'Job rejected' })
    }

    // ─── CLOSE ───
    if (action === 'CLOSE') {
      await db.job.update({
        where: { id: jobId },
        data: { status: 'CLOSED' },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.job_close',
        entity: 'Job',
        entityId: jobId,
        details: { employerId: job.employerId, reason },
        ...client,
      })

      return success({ message: 'Job closed' })
    }

    // ─── FEATURE ───
    if (action === 'FEATURE') {
      const days = featuredDays ?? 30
      const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

      await db.job.update({
        where: { id: jobId },
        data: {
          isFeatured: true,
          featuredExpiry: expiry,
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.job_feature',
        entity: 'Job',
        entityId: jobId,
        details: { employerId: job.employerId, featuredDays: days, expiry: expiry.toISOString() },
        ...client,
      })

      return success({ message: `Job featured for ${days} days` })
    }

    // ─── UNFEATURE ───
    if (action === 'UNFEATURE') {
      await db.job.update({
        where: { id: jobId },
        data: {
          isFeatured: false,
          featuredExpiry: null,
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.job_unfeature',
        entity: 'Job',
        entityId: jobId,
        details: { employerId: job.employerId },
        ...client,
      })

      return success({ message: 'Job unfeatured' })
    }

    return error('Unhandled action')
  } catch (e) {
    console.error('[JOB_MODERATION] POST failed:', e)
    return serverError()
  }
}
