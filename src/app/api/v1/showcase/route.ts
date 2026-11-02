import { db } from '@/lib/db'
import { success, serverError } from '@/lib/api-response'
import { currentMonthKey, expireOldShowcase, generateMonthlyShowcase } from '@/lib/showcase'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/showcase — Active monthly Top-10 showcase (PUBLIC)
// Returns ONLY listings inside the 2-day display window. Auto-expires.
// If a new month has started and nothing was generated yet, the
// showcase is generated automatically from real premium listings.
// No contact information is ever included.
// ═══════════════════════════════════════════════════════════════
export async function GET(_request: NextRequest) {
  try {
    const monthKey = currentMonthKey()
    const now = new Date()

    // Auto-expire anything past its window
    await expireOldShowcase()

    // Lazy monthly generation (auto-schedule): generate once per month
    const existing = await db.premiumShowcase.count({ where: { monthKey, status: { in: ['APPROVED', 'PENDING'] } } })
    if (existing === 0) {
      const ist = new Date(now.getTime() + 5.5 * 3600000)
      const dayOfMonth = ist.getUTCDate()
      if (dayOfMonth <= 10) {
        try {
          await generateMonthlyShowcase(monthKey)
        } catch (e) {
          console.error('[SHOWCASE] auto-generation failed:', e)
        }
      }
    }

    const items = await db.premiumShowcase.findMany({
      where: { monthKey, status: 'APPROVED', startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: [{ module: 'asc' }, { rank: 'asc' }],
      select: {
        id: true, module: true, listingId: true, title: true, subtitle: true,
        imageUrl: true, rank: true, score: true, startsAt: true, endsAt: true,
      },
    })

    return success({
      monthKey,
      active: items.length > 0,
      windowEndsAt: items[0]?.endsAt ?? null,
      items,
      // NOTE: no phone/email — viewers press CONNECT
    })
  } catch (err) {
    console.error('[SHOWCASE GET] Error:', err)
    return serverError('Failed to load showcase')
  }
}
