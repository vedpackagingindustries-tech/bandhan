import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { aiAstrologyMatch } from '@/services/ai'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { profileIdA, profileIdB, birthDetailsA, birthDetailsB } = body

    if (!profileIdA || !profileIdB) {
      return error('Both profileIdA and profileIdB are required')
    }

    const matchResult = await aiAstrologyMatch({ profileIdA, profileIdB, birthDetailsA, birthDetailsB })

    return success({
      profileIdA,
      profileIdB,
      ...matchResult,
      message: 'AI astrology matching is in foundation phase.',
    })
  } catch (err) {
    console.error('[AI ASTROLOGY] Error:', err)
    return serverError('AI astrology match failed')
  }
}
