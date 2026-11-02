import { success, serverError } from '@/lib/api-response'
import { getPublicPricing } from '@/lib/pricing'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/pricing — Public module pricing (no auth)
// Powers the dedicated pricing sections inside each module.
// Prices come from admin configuration (or platform defaults).
// No contact information is ever included in this response.
// ═══════════════════════════════════════════════════════════════
export async function GET(_request: NextRequest) {
  try {
    const pricing = await getPublicPricing()
    return success(pricing)
  } catch (err) {
    console.error('[PRICING GET] Error:', err)
    return serverError('Failed to load pricing')
  }
}
