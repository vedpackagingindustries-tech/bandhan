import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { assistantChat } from '@/services/ai/assistant'
import { NextRequest } from 'next/server'

/**
 * Bandhan AI Assistant — Production
 * POST /api/v1/ai/assistant
 * Body: { message, conversationHistory?, module? }
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const auth = result.auth as any
    const locale = request.headers.get('x-locale') === 'hi' ? 'hi' : 'en'

    const body = await request.json()
    const { message, conversationHistory, module } = body as {
      message?: string
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
      module?: string
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return error('Message is required', 400)
    }

    if (message.length > 2000) {
      return error('Message too long (max 2000 characters)', 400)
    }

    const response = await assistantChat({
      context: {
        userId: auth.userId,
        locale: locale as 'en' | 'hi',
        membershipTier: auth.membershipTier || 'FREE',
        userName: auth.profile?.displayName || undefined,
        module,
      },
      message: message.trim(),
      conversationHistory,
    })

    return success(response)
  } catch (err) {
    console.error('[AI ASSISTANT] Error:', err)
    return serverError('AI assistant failed')
  }
}
