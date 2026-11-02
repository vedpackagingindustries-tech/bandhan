import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit, logSecurityEvent } from '@/lib/audit'
import { NextRequest } from 'next/server'

const VALID_STATUSES = ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']
const VALID_TARGET_TYPES = ['USER', 'MATRIMONY_PROFILE', 'PHOTO', 'BUSINESS', 'JOB', 'DIRECTORY', 'ADVERTISEMENT']
const VALID_ACTIONS = ['RESOLVE', 'DISMISS', 'ESCALATE']
const VALID_ACTION_TYPES = ['BLOCK_USER', 'HIDE_CONTENT', 'SUSPEND']

// ═══════════════════════════════════════════════════════════
// GET — List reports with admin workflow
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const status = sp.get('status')
    const targetType = sp.get('targetType')

    const where: Record<string, unknown> = {}
    if (status && VALID_STATUSES.includes(status)) where.status = status
    if (targetType && VALID_TARGET_TYPES.includes(targetType)) where.targetType = targetType

    // Stats
    const [total, pending, reviewed, resolved, dismissed, reports] = await Promise.all([
      db.report.count({ where }),
      db.report.count({ where: { status: 'PENDING' } }),
      db.report.count({ where: { status: 'REVIEWED' } }),
      db.report.count({ where: { status: 'RESOLVED' } }),
      db.report.count({ where: { status: 'DISMISSED' } }),
      db.report.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
          reviewer: {
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
    ])

    const data = reports.map((r) => ({
      id: r.id,
      reporterId: r.reporterId,
      reporter: {
        id: r.reporter.id,
        email: r.reporter.email,
        name: r.reporter.profile?.displayName || null,
      },
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      description: r.description,
      status: r.status,
      resolution: r.resolution,
      reviewedBy: r.reviewedBy,
      reviewer: r.reviewer
        ? {
            id: r.reviewer.id,
            email: r.reviewer.email,
            name: r.reviewer.profile?.displayName || null,
          }
        : null,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    return success({
      reports: data,
      stats: { total, pending, reviewed, resolved, dismissed },
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[REPORTS_LIST]', err)
    return serverError()
  }
}

// ═══════════════════════════════════════════════════════════
// POST — Resolve/act on report
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const body = await request.json()
    const { reportId, action, resolution, takeAction, actionType } = body

    // Validate required fields
    if (!reportId) return error('reportId is required')
    if (!action || !VALID_ACTIONS.includes(action)) {
      return error(`action must be one of: ${VALID_ACTIONS.join(', ')}`)
    }

    const existing = await db.report.findUnique({ where: { id: reportId } })
    if (!existing) return error('Report not found', 404)
    if (existing.status !== 'PENDING' && existing.status !== 'REVIEWED') {
      return error(`Report is already ${existing.status.toLowerCase()}, cannot act on it`)
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    const now = new Date()

    // Determine new status based on action
    let newStatus: string
    let resolutionText: string | null = resolution || null

    switch (action) {
      case 'RESOLVE':
        newStatus = 'RESOLVED'
        break
      case 'DISMISS':
        newStatus = 'DISMISSED'
        break
      case 'ESCALATE':
        newStatus = 'REVIEWED'
        resolutionText = resolution || 'ESCALATED'
        break
      default:
        return error(`Invalid action: ${action}`)
    }

    // Update the report
    const report = await db.report.update({
      where: { id: reportId },
      data: {
        status: newStatus,
        reviewedBy: auth.user.id,
        reviewedAt: now,
        resolution: resolutionText,
      },
    })

    // Handle takeAction if requested
    let actionTaken: string | null = null

    if (takeAction && actionType) {
      if (!VALID_ACTION_TYPES.includes(actionType)) {
        return error(`actionType must be one of: ${VALID_ACTION_TYPES.join(', ')}`)
      }

      actionTaken = actionType

      if (actionType === 'BLOCK_USER') {
        // Find the reported user based on targetType/targetId
        let userIdToBlock: string | null = null

        if (existing.targetType === 'USER') {
          userIdToBlock = existing.targetId
        } else {
          // For other target types, try to find the owner
          switch (existing.targetType) {
            case 'MATRIMONY_PROFILE': {
              const profile = await db.matrimonyProfile.findUnique({
                where: { id: existing.targetId },
                select: { profileId: true },
              })
              if (profile) {
                const userProf = await db.profile.findUnique({
                  where: { id: profile.profileId },
                  select: { userId: true },
                })
                userIdToBlock = userProf?.userId || null
              }
              break
            }
            case 'BUSINESS': {
              const biz = await db.business.findUnique({
                where: { id: existing.targetId },
                select: { ownerId: true },
              })
              userIdToBlock = biz?.ownerId || null
              break
            }
            case 'JOB': {
              const job = await db.job.findUnique({
                where: { id: existing.targetId },
                select: { employerId: true },
              })
              userIdToBlock = job?.employerId || null
              break
            }
            case 'DIRECTORY': {
              const dir = await db.directory.findUnique({
                where: { id: existing.targetId },
                select: { ownerId: true },
              })
              userIdToBlock = dir?.ownerId || null
              break
            }
          }
        }

        if (userIdToBlock) {
          await db.user.update({
            where: { id: userIdToBlock },
            data: { status: 'BLOCKED' },
          })

          await logSecurityEvent({
            userId: userIdToBlock,
            eventType: 'ACCOUNT_BLOCKED',
            description: `User blocked via report ${reportId}`,
            ipAddress,
            userAgent,
            severity: 'WARNING',
            metadata: {
              reportId,
              targetType: existing.targetType,
              targetId: existing.targetId,
              blockedBy: auth.user.id,
            },
          })
        }
      }

      if (actionType === 'HIDE_CONTENT') {
        // Log the intent — actual content hiding is module-specific
        await logAudit({
          userId: auth.user.id,
          action: 'admin.content_hide_intended',
          entity: existing.targetType,
          entityId: existing.targetId,
          details: {
            reportId,
            targetType: existing.targetType,
            note: 'Content hiding intent logged. Module-specific handler should execute the actual hide.',
          },
          ipAddress,
          userAgent,
        })
      }

      if (actionType === 'SUSPEND') {
        // Log suspend intent (similar to BLOCK_USER but less severe)
        await logAudit({
          userId: auth.user.id,
          action: 'admin.suspend_intended',
          entity: existing.targetType,
          entityId: existing.targetId,
          details: {
            reportId,
            targetType: existing.targetType,
            note: 'Suspension intent logged. Review required before execution.',
          },
          ipAddress,
          userAgent,
        })
      }
    }

    // Audit log for the report resolution
    const auditAction = action === 'RESOLVE'
      ? 'admin.report_resolve'
      : action === 'DISMISS'
        ? 'admin.report_dismiss'
        : 'admin.report_escalate'

    await logAudit({
      userId: auth.user.id,
      action: auditAction,
      entity: 'Report',
      entityId: reportId,
      details: {
        action,
        status: newStatus,
        resolution: resolutionText,
        takeAction: !!takeAction,
        actionType: actionTaken,
        targetType: existing.targetType,
        targetId: existing.targetId,
      },
      ipAddress,
      userAgent,
    })

    return success({ report, actionTaken })
  } catch (err) {
    console.error('[REPORT_ACT]', err)
    return serverError()
  }
}
