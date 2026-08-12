import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { moderateImage, getPendingModeration } from '@/services/ai/moderation'
import { analyzePhotoQuality } from '@/services/ai/photo-quality'
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
    const result = await requireAuth(request)
    if (result.error) return result.error

    // Only admin/moderator can view moderation queue
    const role = (result.auth as any).user?.role;
    if (!role || role.level < 4) {
      return error('Admin access required', 403)
    }

    const { searchParams } = new URL(request.url)
    const verdict = searchParams.get('verdict') || undefined
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const offset = parseInt(searchParams.get('offset') || '0')

    const result_data = await getPendingModeration({ verdict, limit, offset })
    return success(result_data)
  } catch (err) {
    console.error('[AI MODERATION] GET Error:', err)
    return serverError('Failed to get moderation queue')
  }
}
