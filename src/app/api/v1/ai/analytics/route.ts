import { success, serverError } from '@/lib/api-response'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { getAIAnalytics } from '@/services/ai/audit'
import { NextRequest } from 'next/server'

/**
 * AI Analytics (Super Admin only)
 * GET /api/v1/ai/analytics?days=30
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const days = Math.min(365, parseInt(searchParams.get('days') || '30'))

    const analytics = await getAIAnalytics({ days })
    return success(analytics)
  } catch (err) {
    console.error('[AI ANALYTICS] Error:', err)
    return serverError('AI analytics failed')
  }
}
