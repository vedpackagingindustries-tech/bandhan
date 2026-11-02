import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError } from '@/lib/api-response'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════
// GET — Revenue analytics with aggregations
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    // Parse date range
    let startDate: Date | undefined
    let endDate: Date | undefined

    if (sp.get('startDate')) {
      startDate = new Date(sp.get('startDate')!)
      if (isNaN(startDate.getTime())) return error('Invalid startDate format')
    }
    if (sp.get('endDate')) {
      endDate = new Date(sp.get('endDate')!)
      if (isNaN(endDate.getTime())) return error('Invalid endDate format')
    }

    // Default to last 30 days
    if (!startDate) {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      startDate.setHours(0, 0, 0, 0)
    }
    if (!endDate) {
      endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
    }

    const purpose = sp.get('purpose')
    const status = sp.get('status')
    const provider = sp.get('provider')

    // Base where clause with date range
    const dateFilter = {
      createdAt: { gte: startDate, lte: endDate },
    }

    const extraFilter: Record<string, unknown> = {}
    if (purpose) extraFilter.purpose = purpose
    if (status) extraFilter.status = status
    if (provider) extraFilter.provider = provider

    const where = { ...dateFilter, ...extraFilter }

    // ── Summary aggregations ──
    const [totalRevenueAgg, statusCounts] = await Promise.all([
      db.payment.aggregate({
        where: { ...where, status: 'SUCCESS' },
        _sum: { amount: true },
        _count: true,
      }),
      db.payment.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ])

    const statusCountMap: Record<string, number> = {}
    for (const sc of statusCounts) {
      statusCountMap[sc.status] = sc._count
    }

    const summary = {
      totalRevenue: totalRevenueAgg._sum.amount ?? 0,
      totalPayments: await db.payment.count({ where }),
      successCount: statusCountMap['SUCCESS'] || 0,
      failedCount: statusCountMap['FAILED'] || 0,
      refundedCount: statusCountMap['REFUNDED'] || 0,
      pendingCount: (statusCountMap['PENDING'] || 0) + (statusCountMap['INITIATED'] || 0),
    }

    // ── By purpose aggregation ──
    const byPurpose = await db.payment.groupBy({
      by: ['purpose'],
      where,
      _sum: { amount: true },
      _count: true,
    })

    // ── By provider aggregation ──
    const byProvider = await db.payment.groupBy({
      by: ['provider'],
      where,
      _sum: { amount: true },
      _count: true,
    })

    // ── By tier aggregation ──
    const byTier = await db.payment.groupBy({
      by: ['membershipTier'],
      where,
      _sum: { amount: true },
      _count: true,
    })

    // ── Daily breakdown (from paginated results grouped in JS) ──
    const allPayments = await db.payment.findMany({
      where,
      select: {
        createdAt: true,
        amount: true,
        status: true,
        purpose: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const dailyMap: Record<string, { amount: number; count: number; successAmount: number; successCount: number }> = {}
    for (const p of allPayments) {
      const day = p.createdAt.toISOString().slice(0, 10)
      if (!dailyMap[day]) {
        dailyMap[day] = { amount: 0, count: 0, successAmount: 0, successCount: 0 }
      }
      dailyMap[day].amount += p.amount
      dailyMap[day].count += 1
      if (p.status === 'SUCCESS') {
        dailyMap[day].successAmount += p.amount
        dailyMap[day].successCount += 1
      }
    }

    const dailyBreakdown = Object.entries(dailyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, agg]) => ({ date, ...agg }))

    // ── Paginated payment list ──
    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.payment.count({ where }),
    ])

    const paymentsData = payments.map((p) => ({
      id: p.id,
      userId: p.userId,
      user: {
        id: p.user.id,
        email: p.user.email,
        name: p.user.profile?.displayName || null,
      },
      provider: p.provider,
      providerTxnId: p.providerTxnId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      purpose: p.purpose,
      purposeRefId: p.purposeRefId,
      membershipTier: p.membershipTier,
      durationDays: p.durationDays,
      failureReason: p.failureReason,
      refundReason: p.refundReason,
      refundedAt: p.refundedAt,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    }))

    return success({
      summary,
      byPurpose,
      byProvider,
      byTier,
      dailyBreakdown,
      payments: paymentsData,
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[REVENUE_ANALYTICS]', err)
    return serverError()
  }
}
