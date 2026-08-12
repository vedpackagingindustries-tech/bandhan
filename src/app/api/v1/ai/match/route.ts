import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { matchProfiles } from '@/services/ai/match-engine'
import { NextRequest } from 'next/server'

/**
 * AI Match 2.0 — Production Matching Engine
 * POST /api/v1/ai/match
 * Body: { profileIdA, profileIdB }
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const auth = result.auth

    const body = await request.json()
    const { profileIdA, profileIdB } = body

    if (!profileIdA || !profileIdB) {
      return error('Both profileIdA and profileIdB are required')
    }

    // Get locale from header
    const locale = request.headers.get('x-locale') === 'hi' ? 'hi' : 'en'

    const matchResult = await matchProfiles({
      profileIdA,
      profileIdB,
      userId: auth.userId,
      locale,
    })

    return success(matchResult)
  } catch (err) {
    console.error('[AI MATCH] Error:', err)
    return serverError('AI match failed')
  }
}
