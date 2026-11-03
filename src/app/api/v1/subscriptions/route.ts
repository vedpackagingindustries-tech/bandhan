import { db } from '@/lib/db'
import { success, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { getModulePricing } from '@/lib/pricing'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/subscriptions — My module subscriptions + payment history
// Also lazily expires subscriptions past their expiry.
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    // Lazy expiry maintenance
    await db.moduleSubscription.updateMany({
      where: { userId: auth.userId, status: 'ACTIVE', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    })

    const [subscriptions, payments, trialsUsed] = await Promise.all([
      db.moduleSubscription.findMany({
        where: { userId: auth.userId },
        orderBy: { createdAt: 'desc' },
      }),
      db.payment.findMany({
        where: { userId: auth.userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, amount: true, status: true, category: true, module: true,
          planLabel: true, planName: true, utr: true, receiptNo: true,
          paymentDate: true, createdAt: true, verifiedAt: true,
          // NOTE: no upiId/notes leakage — only customer-relevant fields
        },
      }),
      db.moduleSubscription.count({ where: { userId: auth.userId, isTrial: true } }),
    ])

    // Trial eligibility: one 7-day trial per module for eligible new users
    const usedModules = new Set(
      (await db.moduleSubscription.findMany({ where: { userId: auth.userId, isTrial: true }, select: { module: true } })).map((t) => t.module)
    )
    const trialEligibility = {
      usedCount: trialsUsed,
      modules: {
        MATRIMONY: !usedModules.has('MATRIMONY'),
        BUSINESS: !usedModules.has('BUSINESS'),
        JOBS: !usedModules.has('JOBS'),
      },
    }

    // Current entitlements per module
    const now = new Date()
    const entitlements: Record<string, { active: boolean; planLabel: string | null; expiresAt: string | null }> = {
      MATRIMONY: { active: false, planLabel: null, expiresAt: null },
      BUSINESS: { active: false, planLabel: null, expiresAt: null },
      JOBS: { active: false, planLabel: null, expiresAt: null },
      DIRECTORY: { active: false, planLabel: null, expiresAt: null },
    }
    for (const s of subscriptions) {
      if (s.status !== 'ACTIVE') continue
      if (s.expiresAt && s.expiresAt < now) continue
      const cur = entitlements[s.module]
      if (cur && (!cur.active || (s.expiresAt && (!cur.expiresAt || s.expiresAt > new Date(cur.expiresAt))))) {
        entitlements[s.module] = {
          active: true,
          planLabel: s.planLabel ?? s.planName,
          expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
        }
      }
    }

    // Pricing for upgrade prompts (server-configured; no contact info)
    const [matrimony, business, jobs, directory] = await Promise.all([
      getModulePricing('MATRIMONY'), getModulePricing('BUSINESS'),
      getModulePricing('JOBS'), getModulePricing('DIRECTORY'),
    ])

    return success({
      subscriptions,
      payments,
      entitlements,
      trialEligibility,
      pricing: { matrimony, business, jobs, directory },
    })
  } catch (err) {
    console.error('[SUBSCRIPTIONS GET] Error:', err)
    return serverError('Failed to fetch subscriptions')
  }
}
