import { success, serverError } from '@/lib/api-response'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { generateAdminInsights } from '@/services/ai/admin-copilot'
import { NextRequest } from 'next/server'

/**
 * AI Admin Copilot (Super Admin only)
 * GET /api/v1/ai/admin-copilot
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const locale = request.headers.get('x-locale') === 'hi' ? 'hi' : 'en'

    const insights = await generateAdminInsights({
      adminUserId: result.auth.userId,
      locale: locale as 'en' | 'hi',
    })

    return success(insights)
  } catch (err) {
    console.error('[AI ADMIN_COPILOT] Error:', err)
    return serverError('Admin copilot failed')
  }
}
