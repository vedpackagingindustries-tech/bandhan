import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { aiAssistantChat } from '@/services/ai'
import { NextRequest } from 'next/server'

/**
 * AI Assistant Integration Point
 * POST /api/v1/ai/assistant
 * Body: { message, context? }
 * Returns: AI response
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { message, context } = body

    if (!message) return error('Message is required')
    if (message.length > 2000) return error('Message too long (max 2000 characters)')

    const response = await aiAssistantChat({
      userId: authResult.auth.userId,
      message,
      context,
    })

    return success({
      ...response,
      message: 'AI Assistant is in foundation phase.',
    })
  } catch (err) {
    console.error('[AI ASSISTANT] Error:', err)
    return serverError('AI assistant failed')
  }
}
