import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { aiModerateImage } from '@/services/ai'
import { NextRequest } from 'next/server'

/**
 * AI Photo Moderation Integration Point
 * POST /api/v1/ai/moderation
 * Body: { mediaId, imageUrl }
 * Returns: approval status, confidence, flags
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { mediaId, imageUrl } = body

    if (!mediaId || !imageUrl) {
      return error('mediaId and imageUrl are required')
    }

    const moderationResult = await aiModerateImage({ mediaId, imageUrl })

    // Update media record with moderation status
    if (moderationResult.approved) {
      const { db } = await import('@/lib/db')
      await db.media.update({
        where: { id: mediaId },
        data: { aiModerated: true },
      })
    }

    return success({
      mediaId,
      ...moderationResult,
      message: 'AI moderation is in foundation phase. All images are approved by default.',
    })
  } catch (err) {
    console.error('[AI MODERATION] Error:', err)
    return serverError('AI moderation failed')
  }
}
