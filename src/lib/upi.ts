import QRCode from 'qrcode'
import { db } from '@/lib/db'
import { getUpiId, getUpiName, buildUpiLink, getModulePricing, type ModuleKey, type PaymentCategory } from '@/lib/pricing'
import { createNotification } from '@/lib/notification'

// ═══════════════════════════════════════════════════════════════
// BANDHAN UPI PAYMENT CORE
// Centralized direct UPI (NO payment gateway). QR is generated
// server-side with the admin-controlled receiving UPI ID.
// Submitted UTR/screenshots are NOT proof of payment — only admin
// verification of the actual bank/UPI transaction activates a plan.
// ═══════════════════════════════════════════════════════════════

export interface CreatePaymentInput {
  userId: string
  module: ModuleKey
  planName: string
  listingId?: string
}

export async function createUpiPayment(input: CreatePaymentInput) {
  const pricing = await getModulePricing(input.module)
  const plan = pricing.plans.find((p) => p.name === input.planName)
  if (!plan) throw new Error('INVALID_PLAN')

  const upiId = await getUpiId()
  const upiName = await getUpiName()

  const payment = await db.payment.create({
    data: {
      userId: input.userId,
      provider: 'UPI',
      amount: plan.price,
      currency: 'INR',
      status: 'INITIATED',
      purpose: pricing.category,
      purposeRefId: input.listingId ?? null,
      durationDays: plan.days ?? undefined,
      category: pricing.category,
      module: input.module,
      planName: plan.name,
      planLabel: plan.label,
      priceSnapshot: plan.price, // price snapshot — future price changes never alter this purchase
      upiId,
    },
  })

  const upiLink = buildUpiLink({
    upiId,
    payeeName: upiName,
    amount: plan.price,
    txnRef: payment.id,
    note: `Bandhan ${input.module} ${plan.label}`,
  })

  // Server-side QR generation (PNG data URL) — customer scans with any UPI app
  const qrDataUrl = await QRCode.toDataURL(upiLink, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: { dark: '#7c2d12', light: '#ffffff' },
  })

  return { payment, upiLink, qrDataUrl, upiId, payeeName: upiName, plan }
}

export async function notifyAdminsOfPayment(payment: { id: string; amount: number; category?: string | null; planLabel?: string | null }) {
  const admins = await db.user.findMany({
    where: {
      status: 'ACTIVE',
      role: { name: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    },
    select: { id: true },
  })
  await Promise.all(
    admins.map((a) =>
      createNotification({
        userId: a.id,
        type: 'PAYMENT_VERIFICATION',
        title: 'नई भुगतान जांच (New Payment to Verify)',
        message: `Payment of ₹${payment.amount} submitted for verification. Category: ${payment.category ?? '—'}. Plan: ${payment.planLabel ?? '—'}.`,
        channel: 'IN_APP',
        data: { paymentId: payment.id, category: payment.category },
      })
    )
  )
}

export async function notifyUserPaymentStatus(userId: string, paymentId: string, approved: boolean, receiptNo?: string) {
  await createNotification({
    userId,
    type: approved ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED',
    title: approved ? 'भुगतान स्वीकृत ✓ (Payment Approved)' : 'भुगतान अस्वीकृत (Payment Rejected)',
    message: approved
      ? `Your payment has been verified and approved. Receipt: ${receiptNo ?? paymentId}. Your premium benefit is now active.`
      : 'Your payment could not be verified. Please contact support or submit the correct UTR/reference number.',
    channel: 'IN_APP',
    data: { paymentId, receiptNo },
  })
}

/**
 * ATOMIC payment approval + entitlement activation.
 * Guard: updateMany with status='PENDING' — if 0 rows matched, the payment
 * was already processed (prevents duplicate approvals & double activation).
 * Runs entitlement creation in the same transaction as approval.
 */
export async function approvePaymentAtomically(paymentId: string, adminId: string, notes?: string) {
  return db.$transaction(async (tx) => {
    // Atomic guard: only a PENDING payment can transition to APPROVED
    const updated = await tx.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        verifiedById: adminId,
        verifiedAt: new Date(),
        verificationNotes: notes ?? undefined,
        paidAt: new Date(),
      },
    })
    if (updated.count === 0) {
      const existing = await tx.payment.findUnique({ where: { id: paymentId }, select: { id: true, status: true } })
      if (!existing) throw new Error('NOT_FOUND')
      throw new Error('ALREADY_PROCESSED')
    }

    const payment = await tx.payment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new Error('NOT_FOUND')

    // Receipt number: BH-YYYYMMDD-XXXX (unique constraint protects duplicates)
    const receiptNo = await generateReceiptNo(tx)

    await tx.payment.update({
      where: { id: paymentId },
      data: { receiptNo },
    })

    // Activate entitlement based on category
    const days = payment.durationDays ?? 30
    const expiresAt = days > 0 && payment.module !== 'DIRECTORY' ? new Date(Date.now() + days * 86400000) : null

    await tx.moduleSubscription.create({
      data: {
        userId: payment.userId,
        module: payment.module ?? 'OTHER',
        listingId: payment.purposeRefId ?? undefined,
        planName: payment.planName ?? 'MONTHLY',
        planLabel: payment.planLabel ?? undefined,
        priceSnapshot: payment.amount,
        durationDays: payment.durationDays ?? undefined,
        startedAt: new Date(),
        expiresAt,
        status: 'ACTIVE',
        paymentId: payment.id,
        source: 'PAYMENT',
        grantedById: adminId,
      },
    })

    // Module-specific listing premium flags
    await activateListingPremium(tx, payment)

    return { paymentId, receiptNo, expiresAt }
  })
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

async function generateReceiptNo(tx: Tx): Promise<string> {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.floor(1000 + Math.random() * 9000)
    const candidate = `BH-${ymd}-${rand}`
    const exists = await tx.payment.findFirst({ where: { receiptNo: candidate }, select: { id: true } })
    if (!exists) return candidate
  }
  return `BH-${ymd}-${Date.now().toString().slice(-6)}`
}

async function activateListingPremium(tx: Tx, payment: {
  id: string
  userId: string
  module: string | null
  category?: string | null
  purposeRefId: string | null
  durationDays: number | null
}) {
  const premiumUntil = payment.durationDays ? new Date(Date.now() + payment.durationDays * 86400000) : null

  switch (payment.category) {
    case 'MATRIMONY_PREMIUM': {
      const where = payment.purposeRefId ? { id: payment.purposeRefId } : { userId: payment.userId }
      // Premium extends the listing's active period AND flags it featured
      await tx.matrimonyProfile.updateMany({
        where,
        data: {
          ...(premiumUntil ? { isFeatured: true, featuredExpiry: premiumUntil, expiresAt: premiumUntil } : {}),
        },
      })
      if (!payment.purposeRefId) {
        const mp = await tx.matrimonyProfile.findFirst({
          where: { profile: { userId: payment.userId } },
          select: { id: true },
        })
        if (mp) {
          await tx.moduleSubscription.updateMany({
            where: { paymentId: payment.id },
            data: { listingId: mp.id },
          })
        }
      }
      break
    }
    case 'BUSINESS_PREMIUM': {
      await tx.business.updateMany({
        where: payment.purposeRefId ? { id: payment.purposeRefId } : { ownerId: payment.userId },
        data: { featuredExpiry: premiumUntil, ...(premiumUntil ? { expiresAt: premiumUntil } : {}) },
      })
      break
    }
    case 'JOBS_PREMIUM': {
      await tx.job.updateMany({
        where: payment.purposeRefId ? { id: payment.purposeRefId } : { employerId: payment.userId },
        data: { featuredExpiry: premiumUntil, ...(premiumUntil ? { expiresAt: premiumUntil } : {}) },
      })
      break
    }
    case 'DIRECTORY_REGISTRATION': {
      // Directory: one-time ₹250 registration — mark verified activation flag.
      // Listing itself still requires admin approval workflow (isVerified/status).
      await tx.directory.updateMany({
        where: payment.purposeRefId ? { id: payment.purposeRefId } : { ownerId: payment.userId },
        data: { featuredExpiry: null },
      })
      break
    }
    case 'HERO_ADVERTISEMENT': {
      if (payment.purposeRefId) {
        await tx.advertisement.update({
          where: { id: payment.purposeRefId },
          data: {
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: premiumUntil,
          },
        }).catch(() => null)
      }
      break
    }
    default:
      break
  }
}
