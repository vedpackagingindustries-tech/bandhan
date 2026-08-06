import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { aiMatchProfile } from '@/services/ai'
import { NextRequest } from 'next/server'

/**
 * AI Match Integration Point
 * POST /api/v1/ai/match
 * Body: { profileIdA, profileIdB }
 * Returns: compatibility score and factor breakdown
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const body = await request.json()
    const { profileIdA, profileIdB } = body

    if (!profileIdA || !profileIdB) {
      return error('Both profileIdA and profileIdB are required')
    }

    // TODO: Implement actual AI matching
    const matchResult = await aiMatchProfile({ profileIdA, profileIdB })

    return success({
      profileIdA,
      profileIdB,
      ...matchResult,
      message: 'AI matching is in foundation phase. Scores will be populated when AI service is connected.',
    })
  } catch (err) {
    console.error('[AI MATCH] Error:', err)
    return serverError('AI match failed')
  }
}
