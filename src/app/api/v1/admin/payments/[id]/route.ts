import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { approvePaymentAtomically, notifyUserPaymentStatus } from '@/lib/upi'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// PATCH /api/v1/admin/payments/:id — Approve / Reject payment
// APPROVAL IS ATOMIC: guard updateMany(status='PENDING') prevents
// duplicate approvals and double entitlement activation.
// The admin MUST have verified the actual bank/UPI transaction.
// ═══════════════════════════════════════════════════════════════
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const { id } = await params

    const body = await request.json()
    const { action, notes } = body as { action?: 'APPROVE' | 'REJECT'; notes?: string }

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return error('Action must be APPROVE or REJECT')
    }

    const payment = await db.payment.findUnique({
      where: { id },
      include: { user: { select: { id: true, phone: true, profile: { select: { firstName: true, lastName: true } } } } },
    })
    const customerName = [payment?.user?.profile?.firstName, payment?.user?.profile?.lastName].filter(Boolean).join(' ') || null
    if (!payment) return error('Payment not found', 404)

    if (action === 'APPROVE') {
      if (!['PENDING', 'INITIATED'].includes(payment.status)) {
        return error(`Payment is already ${payment.status}. Cannot approve again.`, 409)
      }
      if (payment.status === 'INITIATED' && !payment.utr) {
        return error('Customer has not submitted the UTR/reference number yet. Cannot verify an unsubmitted payment.')
      }

      const { ipAddress, userAgent } = getClientInfo(request)
      try {
        const receipt = await approvePaymentAtomically(id, auth.userId, notes)

        await logAudit({
          userId: auth.userId,
          action: 'payment.approved',
          entity: 'Payment',
          entityId: id,
          details: { amount: payment.amount, category: payment.category, receiptNo: receipt.receiptNo, customer: customerName },
          ipAddress,
          userAgent,
        })

        await notifyUserPaymentStatus(payment.userId, id, true, receipt.receiptNo)

        return success({
          paymentId: id,
          status: 'APPROVED',
          receiptNo: receipt.receiptNo,
          receiptUrl: `/api/v1/payments/${id}/receipt`,
          expiresAt: receipt.expiresAt,
          message: 'Payment approved. Premium entitlement activated and receipt generated.',
        })
      } catch (e) {
        if (e instanceof Error && e.message === 'ALREADY_PROCESSED') {
          return error('Payment was already processed by another admin.', 409)
        }
        throw e
      }
    }

    // REJECT
    if (!['PENDING', 'INITIATED'].includes(payment.status)) {
      return error(`Payment is already ${payment.status}. Cannot reject.`, 409)
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    // Atomic guard for rejection as well
    const rejected = await db.payment.updateMany({
      where: { id, status: { in: ['PENDING', 'INITIATED'] } },
      data: {
        status: 'REJECTED',
        verifiedById: auth.userId,
        verifiedAt: new Date(),
        verificationNotes: notes ?? 'Payment could not be verified against the bank/UPI transaction',
        failureReason: notes ?? 'Verification failed',
      },
    })
    if (rejected.count === 0) return error('Payment was already processed by another admin.', 409)

    await logAudit({
      userId: auth.userId,
      action: 'payment.rejected',
      entity: 'Payment',
      entityId: id,
      details: { amount: payment.amount, category: payment.category, notes },
      ipAddress,
      userAgent,
    })

    await notifyUserPaymentStatus(payment.userId, id, false)

    return success({ paymentId: id, status: 'REJECTED', message: 'Payment rejected. Revenue unchanged.' })
  } catch (err) {
    console.error('[ADMIN PAYMENT PATCH] Error:', err)
    return serverError('Verification failed')
  }
}
