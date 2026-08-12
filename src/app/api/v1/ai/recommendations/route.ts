import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { getRecommendations } from '@/services/ai/recommendations'
import type { RecommendationType } from '@/services/ai/types'
import { NextRequest } from 'next/server'

/**
 * AI Recommendations — Production Service
 * GET /api/v1/ai/recommendations?type=MATRIMONY&limit=10&locale=hi
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const type = (searchParams.get('type') || 'MATRIMONY') as RecommendationType
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '10'))
    const locale = searchParams.get('locale') === 'hi' ? 'hi' : 'en'
    const category = searchParams.get('category') || undefined
    const location = searchParams.get('location') || undefined

    const validTypes: RecommendationType[] = ['MATRIMONY', 'BUSINESS', 'JOB', 'DIRECTORY']
    if (!validTypes.includes(type)) return error('Invalid type. Use MATRIMONY, BUSINESS, JOB, or DIRECTORY.')

    const recommendations = await getRecommendations({
      userId: authResult.auth.userId,
      type,
      limit,
      locale: locale as 'en' | 'hi',
      category,
      location,
    })

    return success({
      type,
      items: recommendations.items,
      total: recommendations.items.length,
    })
  } catch (err) {
    console.error('[AI RECOMMENDATIONS] Error:', err)
    return serverError('AI recommendations failed')
  }
}
