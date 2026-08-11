import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { provider, amount, purpose, purposeRefId, membershipTier, durationDays, metadata } = body
    const VALID_PROVIDERS = ['RAZORPAY', 'STRIPE', 'PAYPAL', 'UPI', 'BANK_TRANSFER', 'MANUAL']
    const VALID_PURPOSES = ['MEMBERSHIP', 'BUSINESS_FEATURED', 'JOB_FEATURED', 'ADVERTISEMENT', 'SPONSORED_LISTING']

    if (!provider || !VALID_PROVIDERS.includes(provider)) return error('Invalid payment provider')
    if (!amount || amount <= 0) return error('Valid amount is required')
    if (!purpose || !VALID_PURPOSES.includes(purpose)) return error('Invalid payment purpose')

    const { ipAddress, userAgent } = getClientInfo(request)
    const payment = await db.payment.create({
      data: {
        userId: auth.userId, provider, amount, purpose, purposeRefId,
        membershipTier, durationDays,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    })

    await logAudit({ userId: auth.userId, action: 'payment.initiate', entity: 'Payment', entityId: payment.id, details: { provider, amount, purpose }, ipAddress, userAgent })
    return success({ payment, message: 'Payment initiated. Complete via provider.' }, 201)
  } catch (err) {
    console.error('[PAYMENT POST] Error:', err)
    return serverError('Failed to initiate payment')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const purpose = searchParams.get('purpose')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = { userId: (result as any).auth.userId }
    if (status) where.status = status
    if (purpose) where.purpose = purpose

    const [items, total] = await Promise.all([
      db.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.payment.count({ where }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[PAYMENTS GET] Error:', err)
    return error('Failed to fetch payments')
  }
}
