import { db } from '@/lib/db'
import { error, serverError, unauthorized } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/payments/:id/receipt — Printable HTML receipt
// Only for APPROVED (or legacy SUCCESS) payments. Owner or admin only.
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result
    const { id } = await params

    const payment = await db.payment.findUnique({
      where: { id },
      include: { user: { select: { phone: true, email: true, profile: { select: { firstName: true, lastName: true } } } } },
    })
    if (!payment) return error('Payment not found', 404)

    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(auth.user.role?.name ?? '')
    if (payment.userId !== auth.userId && !isAdmin) return unauthorized()

    if (!['APPROVED', 'SUCCESS'].includes(payment.status)) {
      return error('Receipt is available only after admin approval of the payment', 400)
    }

    const customerName = [payment.user?.profile?.firstName, payment.user?.profile?.lastName].filter(Boolean).join(' ') || '—'
    const verifiedByRow = payment.verifiedById
      ? await db.user.findUnique({ where: { id: payment.verifiedById }, select: { email: true, profile: { select: { firstName: true, lastName: true } } } })
      : null
    const verifiedBy = verifiedByRow
      ? { name: [verifiedByRow.profile?.firstName, verifiedByRow.profile?.lastName].filter(Boolean).join(' ') || 'Admin', email: verifiedByRow.email }
      : null

    const fmtDate = (d: Date | null) =>
      d ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(d) : '—'

    const html = `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Bandhan Receipt ${payment.receiptNo ?? payment.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background: #f5f0e8; color: #1c1917; padding: 24px 12px; }
  .receipt { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e7ddd0; border-radius: 14px; overflow: hidden; }
  .head { background: linear-gradient(135deg, #7c2d12, #9a3412); color: #fff; padding: 22px 24px; text-align: center; }
  .head h1 { font-size: 24px; letter-spacing: 2px; }
  .head p { opacity: .85; font-size: 12px; margin-top: 4px; }
  .body { padding: 22px 24px; }
  .row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px dashed #eee2d5; font-size: 14px; gap: 12px; }
  .row .k { color: #78716c; }
  .row .v { font-weight: 600; text-align: right; }
  .total { margin-top: 14px; background: #fef3ec; border: 1px solid #f3cdae; border-radius: 10px; padding: 14px 16px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: #7c2d12; }
  .stamp { margin-top: 16px; display: inline-block; border: 2px solid #16a34a; color: #16a34a; border-radius: 8px; padding: 6px 14px; font-weight: 700; letter-spacing: 1px; transform: rotate(-3deg); font-size: 13px; }
  .foot { padding: 16px 24px 22px; text-align: center; color: #a8a29e; font-size: 11.5px; border-top: 1px solid #f0e8dc; }
  .actions { max-width: 560px; margin: 14px auto 0; text-align: center; }
  .btn { display: inline-block; background: #7c2d12; color: #fff; border: 0; border-radius: 10px; padding: 11px 26px; font-size: 14px; font-weight: 600; cursor: pointer; }
  @media print { .actions { display: none; } body { background: #fff; padding: 0; } .receipt { border: none; } }
</style>
</head>
<body>
  <div class="receipt">
    <div class="head">
      <h1>बंधन · BANDHAN</h1>
      <p>Sahu Samaj Community Platform — Payment Receipt</p>
    </div>
    <div class="body">
      <div class="row"><span class="k">Receipt No.</span><span class="v">${payment.receiptNo ?? payment.id}</span></div>
      <div class="row"><span class="k">Transaction ID</span><span class="v">${payment.id}</span></div>
      <div class="row"><span class="k">Customer</span><span class="v">${customerName}</span></div>
      ${payment.user?.phone ? `<div class="row"><span class="k">Mobile</span><span class="v">${payment.user.phone}</span></div>` : ''}
      <div class="row"><span class="k">Category</span><span class="v">${payment.category ?? payment.purpose}</span></div>
      <div class="row"><span class="k">Plan</span><span class="v">${payment.planLabel ?? payment.membershipTier ?? '—'}${payment.durationDays ? ` (${payment.durationDays} days)` : ''}</span></div>
      <div class="row"><span class="k">Payment Method</span><span class="v">UPI — ${payment.upiId ?? ''}</span></div>
      <div class="row"><span class="k">UTR / Reference</span><span class="v">${payment.utr ?? '—'}</span></div>
      <div class="row"><span class="k">Payment Date</span><span class="v">${fmtDate(payment.paymentDate ?? payment.paidAt ?? payment.createdAt)}</span></div>
      <div class="row"><span class="k">Verified By</span><span class="v">${verifiedBy?.name ?? 'Admin'} on ${fmtDate(payment.verifiedAt)}</span></div>
      <div class="total"><span>कुल राशि / Total Paid</span><span>₹${payment.amount.toFixed(2)}</span></div>
      <div class="stamp">VERIFIED ✓ APPROVED</div>
    </div>
    <div class="foot">
      This is a computer-generated receipt for a UPI payment manually verified by the Bandhan administrator against the actual bank/UPI transaction.<br/>
      Generated: ${fmtDate(new Date())} (IST)
    </div>
  </div>
  <div class="actions"><button class="btn" onclick="window.print()">Print / प्रिंट करें</button></div>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[RECEIPT] Error:', err)
    return serverError('Failed to generate receipt')
  }
}
