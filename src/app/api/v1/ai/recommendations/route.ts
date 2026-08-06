import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { aiGetRecommendations } from '@/services/ai'
import { NextRequest } from 'next/server'

/**
 * AI Recommendations Integration Point
 * GET /api/v1/ai/recommendations?type=PROFILES&limit=10
 * Returns: personalized recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const type = (searchParams.get('type') || 'PROFILES') as 'PROFILES' | 'BUSINESSES' | 'JOBS'
    const limit = parseInt(searchParams.get('limit') || '10')

    const validTypes = ['PROFILES', 'BUSINESSES', 'JOBS']
    if (!validTypes.includes(type)) return error('Invalid type. Use PROFILES, BUSINESSES, or JOBS.')

    const recommendations = await aiGetRecommendations({
      userId: authResult.auth.userId,
      type,
      limit,
    })

    return success({
      type,
      ...recommendations,
      message: 'AI recommendations are in foundation phase.',
    })
  } catch (err) {
    console.error('[AI RECOMMENDATIONS] Error:', err)
    return serverError('AI recommendations failed')
  }
}
