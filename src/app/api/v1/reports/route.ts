import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { targetType, targetId, reason, description } = body
    const VALID_TARGETS = ['USER', 'MATRIMONY_PROFILE', 'PHOTO', 'BUSINESS', 'JOB', 'DIRECTORY', 'ADVERTISEMENT']
    const VALID_REASONS = ['INAPPROPRIATE', 'FRAUD', 'SPAM', 'HARASSMENT', 'COPYRIGHT', 'OTHER']

    if (!targetType || !VALID_TARGETS.includes(targetType)) return error('Invalid target type')
    if (!targetId) return error('Target ID is required')
    if (!reason || !VALID_REASONS.includes(reason)) return error('Invalid reason')

    const existing = await db.report.findFirst({ where: { reporterId: auth.userId, targetType, targetId, status: { in: ['PENDING', 'REVIEWED'] } } })
    if (existing) return error('You already reported this')

    const { ipAddress, userAgent } = getClientInfo(request)
    const report = await db.report.create({ data: { reporterId: auth.userId, targetType, targetId, reason, description } })
    await logAudit({ userId: auth.userId, action: 'report.create', entity: 'Report', entityId: report.id, details: { targetType, targetId, reason }, ipAddress, userAgent })

    return success({ report }, 201)
  } catch (err) {
    console.error('[REPORT POST] Error:', err)
    return serverError('Failed to submit report')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { searchParams } = new URL(request.url)
    const targetType = searchParams.get('targetType')
    const status = searchParams.get('status')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = {}
    if (targetType) where.targetType = targetType
    if (status) where.status = status

    const [items, total] = await Promise.all([
      db.report.findMany({ where, include: { reporter: { select: { profile: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.report.count({ where }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[REPORTS GET] Error:', err)
    return error('Failed to fetch reports')
  }
}
