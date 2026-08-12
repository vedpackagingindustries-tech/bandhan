import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { translateText } from '@/services/ai/profile-assistant'
import { NextRequest } from 'next/server'

/**
 * AI Translation (Hindi ↔ English)
 * POST /api/v1/ai/translate
 * Body: { text, from: 'en'|'hi', to: 'en'|'hi' }
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const body = await request.json()
    const { text, from, to } = body
    if (!text || !from || !to) return error('text, from, and to are required')
    if (text.length > 5000) return error('Text too long (max 5000 characters)')
    if (!['en', 'hi'].includes(from) || !['en', 'hi'].includes(to)) return error('Invalid language. Use en or hi.')

    const translated = await translateText({
      text,
      from: from as 'en' | 'hi',
      to: to as 'en' | 'hi',
      userId: result.auth.userId,
    })

    return success(translated)
  } catch (err) {
    console.error('[AI TRANSLATE] Error:', err)
    return serverError('Translation failed')
  }
}
