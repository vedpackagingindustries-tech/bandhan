import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { notifyAdminsOfPayment } from '@/lib/upi'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// POST /api/v1/payments/submit — Customer submits UTR after paying
// UTR is stored for admin verification. This is NOT proof of payment.
// Duplicate UTRs are rejected at the API layer AND by a unique index.
// ═══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { paymentId, utr, paymentDate, screenshotUrl } = body as {
      paymentId?: string; utr?: string; paymentDate?: string; screenshotUrl?: string
    }

    if (!paymentId) return error('Payment ID is required')
    if (!utr || typeof utr !== 'string') return error('UTR / reference number is required')

    const cleanUtr = utr.trim().toUpperCase()
    // UPI UTR is typically a 12-digit number; accept 8–22 alphanumeric reference
    if (!/^[A-Z0-9]{8,22}$/.test(cleanUtr)) {
      return error('Invalid UTR format. It should be 8-22 letters/digits (UPI UTR is usually 12 digits).')
    }

    const payment = await db.payment.findUnique({ where: { id: paymentId } })
    if (!payment) return error('Payment not found', 404)
    if (payment.userId !== auth.userId) return error('Not authorized', 403)
    if (!['INITIATED', 'REJECTED'].includes(payment.status)) {
      return error(`This payment is already ${payment.status}. Please start a new payment.`)
    }

    // Duplicate UTR protection (same UTR used for any other payment)
    const duplicate = await db.payment.findFirst({
      where: { utr: cleanUtr, id: { not: paymentId }, status: { in: ['PENDING', 'APPROVED', 'SUCCESS'] } },
      select: { id: true },
    })
    if (duplicate) {
      return error('This UTR/reference number has already been submitted. Each payment needs its own unique reference number.', 409)
    }

    let parsedDate: Date | undefined
    if (paymentDate) {
      parsedDate = new Date(paymentDate)
      if (isNaN(parsedDate.getTime())) return error('Invalid payment date')
    }

    try {
      const updated = await db.payment.update({
        where: { id: paymentId },
        data: {
          utr: cleanUtr,
          status: 'PENDING',
          paymentDate: parsedDate,
          screenshotUrl: screenshotUrl || undefined,
        },
      })

      const { ipAddress, userAgent } = getClientInfo(request)
      await logAudit({
        userId: auth.userId,
        action: 'payment.utr_submitted',
        entity: 'Payment',
        entityId: payment.id,
        details: { utr: cleanUtr, amount: payment.amount, category: payment.category },
        ipAddress,
        userAgent,
      })

      await notifyAdminsOfPayment(updated)

      return success({
        paymentId: updated.id,
        status: updated.status,
        message: 'UTR submitted. Admin will verify your payment against the actual bank/UPI transaction. Your plan activates only after approval.',
      })
    } catch (e) {
      // Unique constraint race — treat as duplicate UTR
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002') {
        return error('This UTR/reference number has already been submitted.', 409)
      }
      throw e
    }
  } catch (err) {
    console.error('[PAYMENT SUBMIT] Error:', err)
    return serverError('Failed to submit payment reference')
  }
}
