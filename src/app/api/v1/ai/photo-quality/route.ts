import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { analyzePhotoQuality } from '@/services/ai/photo-quality'
import { NextRequest } from 'next/server'

/**
 * AI Photo Quality Analysis
 * POST /api/v1/ai/photo-quality
 * Body: { mediaId, imageUrl, width?, height? }
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const body = await request.json()
    const { mediaId, imageUrl, width, height } = body
    if (!mediaId || !imageUrl) return error('mediaId and imageUrl are required')

    const locale = request.headers.get('x-locale') === 'hi' ? 'hi' : 'en'

    const analysis = await analyzePhotoQuality({
      mediaId,
      imageUrl,
      width,
      height,
      userId: result.auth.userId,
      locale: locale as 'en' | 'hi',
    })

    return success(analysis)
  } catch (err) {
    console.error('[AI PHOTO_QUALITY] Error:', err)
    return serverError('Photo quality analysis failed')
  }
}
