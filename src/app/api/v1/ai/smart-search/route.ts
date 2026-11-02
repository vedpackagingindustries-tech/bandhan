import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { parseSmartSearch } from '@/services/ai/smart-search'
import { NextRequest } from 'next/server'

/**
 * AI Smart Search — Natural language to structured filters
 * POST /api/v1/ai/smart-search
 * Body: { query }
 * Returns: parsed filters + intent (executed through existing secure search)
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const body = await request.json()
    const { query } = body
    if (!query || typeof query !== 'string') return error('query is required')
    if (query.length > 500) return error('Query too long (max 500 characters)')

    const locale = request.headers.get('x-locale') === 'hi' ? 'hi' : 'en'

    const parsed = await parseSmartSearch({
      query,
      userId: result.auth.userId,
      locale: locale as 'en' | 'hi',
    })

    return success(parsed)
  } catch (err) {
    console.error('[AI SMART_SEARCH] Error:', err)
    return serverError('Smart search failed')
  }
}
