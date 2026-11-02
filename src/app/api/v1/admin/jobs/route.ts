import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const { page, limit, skip } = parsePagination(searchParams)
    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [items, total] = await Promise.all([
      db.job.findMany({
        where, include: { employer: { select: { profile: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      db.job.count({ where }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[ADMIN JOBS] Error:', err)
    return error('Failed to fetch jobs')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const body = await request.json()
    const { id, action, reason } = body
    if (!id || !action) return error('ID and action required')

    const job = await db.job.findUnique({ where: { id } })
    if (!job) return error('Job not found', 404)

    const { ipAddress, userAgent } = getClientInfo(request)
    let updated
    if (action === 'APPROVE') {
      updated = await db.job.update({ where: { id }, data: { status: 'ACTIVE', approvedAt: new Date(), approvedBy: auth.userId } })
      await createNotification({ userId: job.employerId, type: 'APPROVAL', title: 'Job Approved', message: `Your job "${job.title}" has been approved.` })
    } else if (action === 'REJECT') {
      updated = await db.job.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason, approvedBy: auth.userId } })
      await createNotification({ userId: job.employerId, type: 'REJECTION', title: 'Job Rejected', message: reason || `Your job "${job.title}" was not approved.` })
    } else if (action === 'FEATURE') {
      updated = await db.job.update({ where: { id }, data: { isFeatured: true, featuredExpiry: new Date(Date.now() + 30 * 86400000) } })
    } else {
      return error('Invalid action')
    }

    await logAudit({ userId: auth.userId, action: `admin.job.${action.toLowerCase()}`, entity: 'Job', entityId: id, details: { action }, ipAddress, userAgent })
    return success({ job: updated })
  } catch (err) {
    console.error('[ADMIN JOBS PUT] Error:', err)
    return error('Failed to update job')
  }
}
