import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { analyzeProfile } from '@/services/ai/profile-assistant'
import { NextRequest } from 'next/server'

/**
 * AI Profile Assistant
 * POST /api/v1/ai/profile-assist — Analyze profile and get suggestions
 * Body: { profileId }
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const body = await request.json()
    const { profileId } = body
    if (!profileId) return error('profileId is required')

    const locale = request.headers.get('x-locale') === 'hi' ? 'hi' : 'en'

    const analysis = await analyzeProfile({
      profileId,
      userId: result.auth.userId,
      locale: locale as 'en' | 'hi',
    })

    return success(analysis)
  } catch (err) {
    console.error('[AI PROFILE_ASSIST] Error:', err)
    return serverError('Profile analysis failed')
  }
}
