import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createUpiPayment } from '@/lib/upi'
import type { ModuleKey } from '@/lib/pricing'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// POST /api/v1/payments/qr — Create a UPI payment + QR code
// Amount & UPI ID are computed SERVER-SIDE from admin pricing config.
// The customer can NEVER change the receiving UPI ID or amount.
// ═══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { module, planName, listingId } = body as { module?: string; planName?: string; listingId?: string }

    const VALID_MODULES: ModuleKey[] = ['MATRIMONY', 'BUSINESS', 'JOBS', 'DIRECTORY', 'HERO_AD']
    if (!module || !VALID_MODULES.includes(module as ModuleKey)) {
      return error('Valid module is required (MATRIMONY, BUSINESS, JOBS, DIRECTORY, HERO_AD)')
    }
    if (!planName) return error('Plan selection is required')

    // Validate listing ownership when a listing-specific premium is bought
    if (listingId) {
      const owner = await resolveListingOwner(module as ModuleKey, listingId)
      if (!owner) return error('Listing not found', 404)
      if (owner !== auth.userId) return error('You can only purchase premium for your own listing', 403)
    }

    try {
      const { payment, upiLink, qrDataUrl, upiId, payeeName, plan } = await createUpiPayment({
        userId: auth.userId,
        module: module as ModuleKey,
        planName,
        listingId,
      })

      const { ipAddress, userAgent } = getClientInfo(request)
      await logAudit({
        userId: auth.userId,
        action: 'payment.qr_created',
        entity: 'Payment',
        entityId: payment.id,
        details: { module, planName, amount: payment.amount },
        ipAddress,
        userAgent,
      })

      return success({
        paymentId: payment.id,
        amount: payment.amount,
        currency: 'INR',
        planName: plan.name,
        planLabel: plan.label,
        durationDays: plan.days,
        module,
        upiId,             // receiving UPI ID (admin-controlled)
        payeeName,
        upiLink,
        qrDataUrl,
        status: payment.status,
        note: 'Scan the QR with any UPI app. After paying, submit the UTR/reference number for admin verification. Your plan activates only after admin approval.',
      }, 201)
    } catch (e) {
      if (e instanceof Error && e.message === 'INVALID_PLAN') {
        return error('Invalid plan for this module')
      }
      throw e
    }
  } catch (err) {
    console.error('[PAYMENT QR] Error:', err)
    return serverError('Failed to create payment')
  }
}

async function resolveListingOwner(module: ModuleKey, listingId: string): Promise<string | null> {
  switch (module) {
    case 'MATRIMONY': {
      const mp = await db.matrimonyProfile.findUnique({ where: { id: listingId }, select: { profile: { select: { userId: true } } } })
      return mp?.profile.userId ?? null
    }
    case 'BUSINESS': {
      const b = await db.business.findUnique({ where: { id: listingId }, select: { ownerId: true } })
      return b?.ownerId ?? null
    }
    case 'JOBS': {
      const j = await db.job.findUnique({ where: { id: listingId }, select: { employerId: true } })
      return j?.employerId ?? null
    }
    case 'DIRECTORY': {
      const d = await db.directory.findUnique({ where: { id: listingId }, select: { ownerId: true } })
      return d?.ownerId ?? null
    }
    default:
      return null
  }
}
