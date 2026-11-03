import { db } from '@/lib/db'
import { success, error, serverError } from '@/lib/api-response'
import { requireAdmin, requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/admin/payments — Searchable payment register (ADMIN+)
// Filters: q (name/utr/id/phone), category, status, dateFrom, dateTo
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const q = sp.get('q')?.trim()
    const category = sp.get('category')
    const status = sp.get('status')
    const dateFrom = sp.get('dateFrom')
    const dateTo = sp.get('dateTo')

    const where: Prisma.PaymentWhereInput = {}

    if (category && category !== 'ALL') where.category = category
    if (status && status !== 'ALL') {
      where.status = status
    } else if (!status) {
      // Default register view: show verification-relevant + approved payments
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom && !isNaN(new Date(dateFrom).getTime())) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom)
      }
      if (dateTo && !isNaN(new Date(dateTo).getTime())) {
        const d = new Date(dateTo)
        d.setHours(23, 59, 59, 999)
        ;(where.createdAt as Prisma.DateTimeFilter).lte = d
      }
    }

    if (q) {
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { utr: { contains: q, mode: 'insensitive' } },
        { receiptNo: { contains: q, mode: 'insensitive' } },
        { user: { phone: { contains: q } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { profile: { firstName: { contains: q, mode: 'insensitive' } } } },
        { user: { profile: { lastName: { contains: q, mode: 'insensitive' } } } },
      ]
    }

    const [items, total, aggregate] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, phone: true, email: true, membershipTier: true, profile: { select: { firstName: true, lastName: true } } } },
          verifiedBy: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      }),
      db.payment.count({ where }),
      db.payment.aggregate({ where, _sum: { amount: true } }),
    ])

    return success({
      items,
      totalAmount: aggregate._sum.amount ?? 0,
      ...paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[ADMIN PAYMENTS GET] Error:', err)
    return serverError('Failed to fetch payments')
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/v1/admin/payments — Bulk expire check helper (SUPER_ADMIN)
// POST is not used here; verification is per-payment via /admin/payments/:id
// ═══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const saCheck = await requireSuperAdmin(request)
    if (saCheck.error) return saCheck.error

    // Expire stale INITIATED payments older than 7 days (never paid/submitted)
    const stale = await db.payment.updateMany({
      where: { status: 'INITIATED', createdAt: { lt: new Date(Date.now() - 7 * 86400000) } },
      data: { status: 'CANCELLED' },
    })
    return success({ cancelledStale: stale.count })
  } catch (err) {
    console.error('[ADMIN PAYMENTS POST] Error:', err)
    return serverError('Cleanup failed')
  }
}

export function PUT() { return error('Method not allowed', 405) }
export function DELETE() { return error('Method not allowed', 405) }
