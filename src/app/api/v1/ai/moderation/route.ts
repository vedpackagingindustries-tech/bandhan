import { success, error, serverError } from '@/lib/api-response'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'
import { moderateImage, getPendingModeration } from '@/services/ai/moderation'
import { NextRequest } from 'next/server'

/**
 * AI Photo Moderation
 * POST /api/v1/ai/moderation — Moderate an image
 * GET /api/v1/ai/moderation — Get pending moderation queue (admin)
 */

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const body = await request.json()
    const { mediaId, imageUrl } = body

    if (!mediaId || !imageUrl) {
      return error('mediaId and imageUrl are required')
    }

    const modResult = await moderateImage({
      mediaId,
      imageUrl,
      userId: result.auth.userId,
    })

    return success(modResult)
  } catch (err) {
    console.error('[AI MODERATION] Error:', err)
    return serverError('AI moderation failed')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const verdict = searchParams.get('verdict') || undefined
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const offset = parseInt(searchParams.get('offset') || '0')

    const data = await getPendingModeration({ verdict, limit, offset })
    return success(data)
  } catch (err) {
    console.error('[AI MODERATION] GET Error:', err)
    return serverError('Failed to get moderation queue')
  }
}
