import { success, error, serverError } from '@/lib/api-response'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { reviewModeration } from '@/services/ai/moderation'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

/**
 * Admin AI Moderation Management
 * GET /api/v1/ai/admin/moderation — View moderation queue
 * POST /api/v1/ai/admin/moderation — Review a moderation result
 */

export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const verdict = searchParams.get('verdict') || undefined
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = {}
    if (verdict) (where as Record<string, unknown>).verdict = verdict

    const [items, total] = await Promise.all([
      db.moderationResult.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.moderationResult.count({ where }),
    ])

    return success({ items, total })
  } catch (err) {
    console.error('[AI ADMIN MODERATION] Error:', err)
    return serverError('Failed to get moderation queue')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const body = await request.json()
    const { mediaId, outcome } = body
    if (!mediaId || !outcome) return error('mediaId and outcome are required')
    if (!['UPHELD', 'OVERTURNED', 'ESCALATED'].includes(outcome)) {
      return error('Invalid outcome. Use UPHELD, OVERTURNED, or ESCALATED.')
    }

    const reviewed = await reviewModeration({
      mediaId,
      adminUserId: result.auth.userId,
      outcome,
    })

    return success(reviewed)
  } catch (err) {
    console.error('[AI ADMIN MODERATION] POST Error:', err)
    return serverError('Moderation review failed')
  }
}
