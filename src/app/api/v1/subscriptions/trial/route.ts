import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { getModulePricing, DEFAULT_PRICING, type ModuleKey } from '@/lib/pricing'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// POST /api/v1/subscriptions/trial — activate the one-time free trial
// for a module (7 days by default). One trial per user per module,
// enforced server-side. TRIAL is NOT a paid plan — no payment needed.
// ═══════════════════════════════════════════════════════════════
const VALID_MODULES: ModuleKey[] = ['MATRIMONY', 'BUSINESS', 'JOBS']

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json().catch(() => ({}))
    const moduleKey = String(body?.module || '').toUpperCase() as ModuleKey
    if (!VALID_MODULES.includes(moduleKey)) {
      return error('अमान्य मॉड्यूल। (Invalid module — trial is available for Matrimony, Business and Jobs only.)', 400)
    }

    // One trial per module per user — enforced here, not trusting the client
    const existing = await db.moduleSubscription.findFirst({
      where: { userId: auth.userId, module: moduleKey, isTrial: true },
      select: { id: true },
    })
    if (existing) {
      return error('आपने इस मॉड्यूल का मुफ़्त ट्रायल पहले ही उपयोग कर लिया है। (You have already used the free trial for this module.)', 409)
    }

    // If the user already has an ACTIVE paid subscription on this module, no trial needed
    const now = new Date()
    const activePaid = await db.moduleSubscription.findFirst({
      where: {
        userId: auth.userId, module: moduleKey, status: 'ACTIVE', isTrial: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    })
    if (activePaid) {
      return error('इस मॉड्यूल पर आपकी प्रीमियम सदस्यता पहले से सक्रिय है। (A paid subscription is already active on this module.)', 409)
    }

    const pricing = await getModulePricing(moduleKey).catch(() => DEFAULT_PRICING[moduleKey])
    const days = pricing.trial?.enabled ? pricing.trial.days : 7
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const trial = await db.moduleSubscription.create({
      data: {
        userId: auth.userId,
        module: moduleKey,
        planName: `TRIAL_${days}D`,
        planLabel: `Free Trial · ${days} दिन`,
        priceSnapshot: 0,
        currency: 'INR',
        durationDays: days,
        isTrial: true,
        startedAt: now,
        expiresAt,
        status: 'ACTIVE',
        source: 'TRIAL',
      },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'subscription.trial.activated',
      entity: 'ModuleSubscription',
      entityId: trial.id,
      details: { module: moduleKey, days },
      ipAddress,
      userAgent,
    })

    return success({
      subscription: trial,
      message: `मुफ़्त ट्रायल सक्रिय! ${days} दिनों तक ${moduleKey} प्रीमियम का आनंद लें। (Free trial activated for ${days} days.)`,
    }, 201)
  } catch (err) {
    console.error('[SUBSCRIPTION TRIAL] Error:', err)
    return serverError('ट्रायल सक्रिय करने में विफल। (Failed to activate trial.)')
  }
}
