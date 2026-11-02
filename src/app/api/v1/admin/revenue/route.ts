import { db } from '@/lib/db'
import { success, serverError } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { resolvePreset, VERIFIED_STATUSES, istDayKey, istMonthKey, istYearKey, istMidnightRange } from '@/lib/ist'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/admin/revenue — Financial revenue dashboard (ADMIN+)
// All figures come from ACTUAL verified transactions (status APPROVED
// or legacy SUCCESS). Pending & rejected payments are NEVER counted
// as collected revenue. All boundaries use Asia/Kolkata.
// ═══════════════════════════════════════════════════════════════

const CATEGORIES = [
  { key: 'MATRIMONY_PREMIUM', label: 'Matrimony', legacy: ['MATRIMONY_PREMIUM'] },
  { key: 'BUSINESS_PREMIUM', label: 'Business', legacy: ['BUSINESS_PREMIUM', 'BUSINESS_FEATURED'] },
  { key: 'JOBS_PREMIUM', label: 'Jobs', legacy: ['JOBS_PREMIUM', 'JOB_FEATURED'] },
  { key: 'DIRECTORY_REGISTRATION', label: 'Directory', legacy: ['DIRECTORY_REGISTRATION'] },
  { key: 'HERO_ADVERTISEMENT', label: 'Hero Ads', legacy: ['HERO_ADVERTISEMENT', 'ADVERTISEMENT'] },
  { key: 'OTHER', label: 'Other', legacy: ['OTHER', 'MEMBERSHIP', 'SPONSORED_LISTING'] },
]

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const preset = sp.get('preset') || 'last30days'
    const range = resolvePreset(preset, sp.get('startDate'), sp.get('endDate'))
    const now = new Date()
    const todayRange = istMidnightRange(now)

    // Fetch all payments once (payment ledger is compact; single scan beats N queries)
    const payments = await db.payment.findMany({
      select: {
        id: true, amount: true, status: true, category: true, purpose: true,
        planLabel: true, createdAt: true, paymentDate: true, userId: true,
        user: { select: { phone: true, profile: { select: { firstName: true, lastName: true } } } },
        receiptNo: true, utr: true,
      },
    })

    const inRange = payments.filter((p) => p.createdAt >= range.start && p.createdAt <= range.end)
    const isVerified = (p: (typeof payments)[number]) => VERIFIED_STATUSES.includes(p.status)

    // ── Per-category cards ──
    const categories = CATEGORIES.map((c) => {
      const catPayments = payments.filter((p) => c.legacy.includes(p.category ?? p.purpose))
      const verified = catPayments.filter(isVerified)
      const today = verified.filter((p) => p.createdAt >= todayRange.start && p.createdAt <= todayRange.end)
      const monthPayments = verified.filter((p) => istMonthKey(p.createdAt) === istMonthKey(now))
      const yearPayments = verified.filter((p) => istYearKey(p.createdAt) === istYearKey(now))
      return {
        key: c.key,
        label: c.label,
        totalRevenue: round2(sum(verified)),
        totalTransactions: verified.length,
        todayCollection: round2(sum(today)),
        todayTransactions: today.length,
        thisMonth: round2(sum(monthPayments)),
        thisMonthTransactions: monthPayments.length,
        thisYear: round2(sum(yearPayments)),
        allTime: round2(sum(verified)),
        pending: { count: catPayments.filter((p) => p.status === 'PENDING').length, amount: round2(sum(catPayments.filter((p) => p.status === 'PENDING'))) },
        rejected: { count: catPayments.filter((p) => p.status === 'REJECTED').length, amount: round2(sum(catPayments.filter((p) => p.status === 'REJECTED'))) },
        refunded: { count: catPayments.filter((p) => p.status === 'REFUNDED').length, amount: round2(sum(catPayments.filter((p) => p.status === 'REFUNDED'))) },
      }
    })

    const allVerified = payments.filter(isVerified)
    const consolidated = {
      totalRevenue: round2(sum(allVerified)),
      totalTransactions: allVerified.length,
      todayCollection: round2(sum(allVerified.filter((p) => p.createdAt >= todayRange.start && p.createdAt <= todayRange.end))),
      thisMonth: round2(sum(allVerified.filter((p) => istMonthKey(p.createdAt) === istMonthKey(now)))),
      thisYear: round2(sum(allVerified.filter((p) => istYearKey(p.createdAt) === istYearKey(now)))),
      pending: { count: payments.filter((p) => p.status === 'PENDING').length, amount: round2(sum(payments.filter((p) => p.status === 'PENDING'))) },
      rejected: { count: payments.filter((p) => p.status === 'REJECTED').length },
    }

    // ── Range-scoped summary (for the selected preset) ──
    const rangeVerified = inRange.filter(isVerified)
    const rangeSummary = {
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      revenue: round2(sum(rangeVerified)),
      transactions: rangeVerified.length,
      byCategory: CATEGORIES.map((c) => ({
        key: c.key,
        label: c.label,
        amount: round2(sum(rangeVerified.filter((p) => c.legacy.includes(p.category ?? p.purpose)))),
        count: rangeVerified.filter((p) => c.legacy.includes(p.category ?? p.purpose)).length,
      })),
    }

    // ── Series: daily (last 30 days), monthly (last 12 months), yearly (last 5 years) ──
    const daily: Array<{ day: string; amount: number; count: number }> = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      const key = istDayKey(d)
      const items = allVerified.filter((p) => istDayKey(p.createdAt) === key)
      daily.push({ day: key, amount: round2(sum(items)), count: items.length })
    }
    const monthly: Array<{ month: string; amount: number; count: number }> = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 15)
      const key = istMonthKey(d)
      const items = allVerified.filter((p) => istMonthKey(p.createdAt) === key)
      monthly.push({ month: key, amount: round2(sum(items)), count: items.length })
    }
    const yearly: Array<{ year: string; amount: number; count: number }> = []
    for (let i = 4; i >= 0; i--) {
      const y = String(now.getFullYear() - i)
      const items = allVerified.filter((p) => istYearKey(p.createdAt) === y)
      yearly.push({ year: y, amount: round2(sum(items)), count: items.length })
    }

    // ── Customer-wise (top 20 by verified revenue) ──
    const custMap = new Map<string, { name: string; phone: string; count: number; amount: number }>()
    for (const p of allVerified) {
      const key = p.user?.phone ?? p.userId
      const uname = [p.user?.profile?.firstName, p.user?.profile?.lastName].filter(Boolean).join(' ') || '—'
      const agg = custMap.get(key) ?? { name: uname, phone: p.user?.phone ?? '—', count: 0, amount: 0 }
      agg.count++; agg.amount += p.amount
      custMap.set(key, agg)
    }
    const topCustomers = [...custMap.entries()]
      .map(([k, v]) => ({ key: k, ...v, amount: round2(v.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20)

    return success({
      categories,
      consolidated,
      range: rangeSummary,
      series: { daily, monthly, yearly },
      topCustomers,
      timezone: 'Asia/Kolkata',
      note: 'Only admin-verified (APPROVED) payments count as collected revenue. Pending and rejected payments are excluded.',
    })
  } catch (err) {
    console.error('[REVENUE GET] Error:', err)
    return serverError('Failed to compute revenue analytics')
  }
}

function sum(items: Array<{ amount: number }>): number {
  return items.reduce((s, p) => s + p.amount, 0)
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
