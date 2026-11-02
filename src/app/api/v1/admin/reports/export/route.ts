import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { error, serverError, getClientInfo } from '@/lib/api-response'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { resolvePreset, VERIFIED_STATUSES, istDayKey, istMonthKey, istYearKey } from '@/lib/ist'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/admin/reports/export?type=...&preset=... — REAL .xlsx
// Restricted to SUPER_ADMIN. Generated from actual database
// transactions only — never sample data.
//
// Report types:
//  COMPLETE | MATRIMONY | BUSINESS | JOBS | DIRECTORY | HERO_AD | OTHER
//  PENDING | APPROVED | REJECTED
//  CUSTOMER | DAILY | MONTHLY | YEARLY
// ═══════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  MATRIMONY_PREMIUM: 'Matrimony Premium',
  BUSINESS_PREMIUM: 'Business Premium',
  JOBS_PREMIUM: 'Jobs Premium',
  DIRECTORY_REGISTRATION: 'Directory Registration',
  HERO_ADVERTISEMENT: 'Hero Advertisement',
  OTHER: 'Other',
  MEMBERSHIP: 'Membership (Legacy)',
  BUSINESS_FEATURED: 'Business Featured (Legacy)',
  JOB_FEATURED: 'Job Featured (Legacy)',
  ADVERTISEMENT: 'Advertisement (Legacy)',
  SPONSORED_LISTING: 'Sponsored Listing (Legacy)',
}

const VALID_TYPES = ['COMPLETE', 'MATRIMONY', 'BUSINESS', 'JOBS', 'DIRECTORY', 'HERO_AD', 'OTHER', 'PENDING', 'APPROVED', 'REJECTED', 'CUSTOMER', 'DAILY', 'MONTHLY', 'YEARLY']

interface PaymentRow {
  id: string
  receiptNo: string | null
  amount: number
  status: string
  category: string | null
  purpose: string
  planLabel: string | null
  membershipTier: string | null
  utr: string | null
  paymentDate: Date | null
  paidAt: Date | null
  createdAt: Date
  userName: string | null
  userPhone: string | null
  verifierName: string | null
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const sp = request.nextUrl.searchParams
    const type = (sp.get('type') || 'COMPLETE').toUpperCase()
    const preset = sp.get('preset') || 'thisMonth'
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    const range = resolvePreset(preset, startDate, endDate)

    if (!VALID_TYPES.includes(type)) return error(`Invalid report type. Valid: ${VALID_TYPES.join(', ')}`)

    const where: Record<string, unknown> = { createdAt: { gte: range.start, lte: range.end } }

    if (['MATRIMONY', 'BUSINESS', 'JOBS', 'DIRECTORY', 'HERO_AD', 'OTHER'].includes(type)) {
      const categoryMap: Record<string, string[]> = {
        MATRIMONY: ['MATRIMONY_PREMIUM'],
        BUSINESS: ['BUSINESS_PREMIUM', 'BUSINESS_FEATURED'],
        JOBS: ['JOBS_PREMIUM', 'JOB_FEATURED'],
        DIRECTORY: ['DIRECTORY_REGISTRATION'],
        HERO_AD: ['HERO_ADVERTISEMENT', 'ADVERTISEMENT'],
        OTHER: ['OTHER'],
      }
      where.category = { in: categoryMap[type] }
      where.status = { in: VERIFIED_STATUSES } // category revenue reports = verified only
    } else if (['PENDING', 'APPROVED', 'REJECTED'].includes(type)) {
      where.status = type === 'APPROVED' ? { in: VERIFIED_STATUSES } : type
    }

    const rows = await db.payment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { phone: true, profile: { select: { firstName: true, lastName: true } } } },
        verifiedBy: { select: { profile: { select: { firstName: true, lastName: true } } } },
      },
    })

    const payments: PaymentRow[] = rows.map((p) => ({
      id: p.id,
      receiptNo: p.receiptNo,
      amount: p.amount,
      status: p.status,
      category: p.category,
      purpose: p.purpose,
      planLabel: p.planLabel,
      membershipTier: p.membershipTier,
      utr: p.utr,
      paymentDate: p.paymentDate,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      userName: [p.user?.profile?.firstName, p.user?.profile?.lastName].filter(Boolean).join(' ') || null,
      userPhone: p.user?.phone ?? null,
      verifierName: [p.verifiedBy?.profile?.firstName, p.verifiedBy?.profile?.lastName].filter(Boolean).join(' ') || null,
    }))

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Bandhan Admin'
    wb.created = new Date()

    if (type === 'DAILY' || type === 'MONTHLY' || type === 'YEARLY') {
      buildSeriesSheet(wb, type, payments, range)
    } else if (type === 'CUSTOMER') {
      buildCustomerSheet(wb, payments, range)
    } else {
      buildTransactionsSheet(wb, type, payments, range)
    }
    buildSummarySheet(wb, payments, range, type)

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'report.exported',
      entity: 'Report',
      entityId: type,
      details: { type, preset, rows: payments.length },
      ipAddress,
      userAgent,
    })

    const buffer = await wb.xlsx.writeBuffer()
    const filename = `Bandhan-${type}-${range.label.replace(/[^\w-]+/g, '_')}.xlsx`

    return new Response(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[REPORT EXPORT] Error:', err)
    return serverError('Failed to generate report')
  }
}

const HEADERS = ['Transaction ID', 'Customer Name', 'Mobile', 'Category', 'Plan', 'Amount (₹)', 'UTR', 'Payment Date', 'Status', 'Verified By']
const istFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })

function buildTransactionsSheet(wb: ExcelJS.Workbook, type: string, payments: PaymentRow[], range: { label: string }) {
  const ws = wb.addWorksheet('Transactions', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  ws.mergeCells('A1:J1')
  const title = ws.getCell('A1')
  title.value = 'बंधन · BANDHAN'
  title.font = { size: 20, bold: true, color: { argb: 'FF7C2D12' } }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  ws.mergeCells('A2:J2')
  const sub = ws.getCell('A2')
  sub.value = `Report: ${reportTitle(type)}`
  sub.font = { size: 13, bold: true }
  sub.alignment = { horizontal: 'center' }

  ws.mergeCells('A3:J3')
  const meta = ws.getCell('A3')
  meta.value = `Date Range: ${range.label}  |  Generated: ${istFmt.format(new Date())} IST  |  Transactions: ${payments.length}`
  meta.font = { size: 10, color: { argb: 'FF78716C' } }
  meta.alignment = { horizontal: 'center' }

  const headerRow = ws.getRow(5)
  HEADERS.forEach((h, i) => {
    const c = headerRow.getCell(i + 1)
    c.value = h
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  let sum = 0
  payments.forEach((p, idx) => {
    const row = ws.getRow(6 + idx)
    const values: (string | number | Date)[] = [
      p.receiptNo ?? p.id,
      p.userName ?? '—',
      p.userPhone ?? '—',
      CATEGORY_LABELS[p.category ?? p.purpose] ?? p.category ?? p.purpose ?? '—',
      p.planLabel ?? p.membershipTier ?? '—',
      p.amount,
      p.utr ?? '—',
      p.paymentDate ?? p.paidAt ?? p.createdAt,
      p.status,
      p.verifierName ?? '—',
    ]
    values.forEach((v, i) => {
      const c = row.getCell(i + 1)
      if (i === 5) {
        c.value = Number(v)
        c.numFmt = '₹ #,##0.00'
      } else if (i === 7) {
        c.value = v as Date
        c.numFmt = 'dd-mmm-yyyy hh:mm AM/PM'
      } else {
        c.value = String(v)
      }
      c.border = { bottom: { style: 'hair', color: { argb: 'FFE7DDD0' } } }
    })
    sum += p.amount
  })

  const totalRow = ws.getRow(6 + payments.length)
  totalRow.getCell(5).value = 'GRAND TOTAL'
  totalRow.getCell(5).font = { bold: true }
  totalRow.getCell(5).border = { top: { style: 'double' } }
  const totalCell = totalRow.getCell(6)
  totalCell.value = sum
  totalCell.numFmt = '₹ #,##0.00'
  totalCell.font = { bold: true, color: { argb: 'FF7C2D12' } }
  totalCell.border = { top: { style: 'double' } }

  const widths = [24, 20, 16, 22, 18, 14, 18, 20, 12, 18]
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  if (payments.length > 0) {
    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + payments.length, column: 10 } }
  }
}

function buildSummarySheet(wb: ExcelJS.Workbook, payments: PaymentRow[], range: { label: string }, type: string) {
  const ws = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 3 }] })

  ws.mergeCells('A1:D1')
  ws.getCell('A1').value = 'BANDHAN — Revenue Summary'
  ws.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF7C2D12' } }
  ws.getCell('A2').value = `Range: ${range.label} | Report: ${reportTitle(type)} | Generated: ${istFmt.format(new Date())} IST`
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF78716C' } }

  const header = ws.getRow(4)
  ;['Category', 'Transactions', 'Verified Revenue (₹)'].forEach((h, i) => {
    const c = header.getCell(i + 1)
    c.value = h
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } }
  })

  const byCategory = new Map<string, { count: number; sum: number }>()
  let grand = 0, grandCount = 0
  for (const p of payments) {
    if (!VERIFIED_STATUSES.includes(p.status)) continue
    const key = CATEGORY_LABELS[p.category ?? p.purpose] ?? 'Other'
    const agg = byCategory.get(key) ?? { count: 0, sum: 0 }
    agg.count++; agg.sum += p.amount
    byCategory.set(key, agg)
    grand += p.amount; grandCount++
  }

  let r = 5
  for (const [cat, agg] of byCategory) {
    ws.getRow(r).getCell(1).value = cat
    ws.getRow(r).getCell(2).value = agg.count
    const c = ws.getRow(r).getCell(3)
    c.value = agg.sum
    c.numFmt = '₹ #,##0.00'
    r++
  }
  ws.getRow(r).getCell(1).value = 'GRAND TOTAL (verified only)'
  ws.getRow(r).getCell(1).font = { bold: true }
  ws.getRow(r).getCell(2).value = grandCount
  ws.getRow(r).getCell(2).font = { bold: true }
  const g = ws.getRow(r).getCell(3)
  g.value = grand
  g.numFmt = '₹ #,##0.00'
  g.font = { bold: true, color: { argb: 'FF7C2D12' } }

  const pending = payments.filter((p) => p.status === 'PENDING')
  ws.getRow(r + 2).getCell(1).value = 'Pending verification (NOT counted as revenue):'
  const pc = ws.getRow(r + 2).getCell(3)
  pc.value = pending.reduce((s, p) => s + p.amount, 0)
  pc.numFmt = '₹ #,##0.00'

  ws.getColumn(1).width = 36
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 22
}

function buildSeriesSheet(wb: ExcelJS.Workbook, type: string, payments: PaymentRow[], range: { label: string }) {
  const ws = wb.addWorksheet(`${type.charAt(0)}${type.slice(1).toLowerCase()} Collection`, { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.mergeCells('A1:C1')
  ws.getCell('A1').value = `BANDHAN — ${reportTitle(type)}`
  ws.getCell('A1').font = { size: 15, bold: true, color: { argb: 'FF7C2D12' } }
  ws.getCell('A2').value = `Range: ${range.label} | IST day/month/year boundaries | Generated: ${istFmt.format(new Date())} IST`
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF78716C' } }

  const header = ws.getRow(4)
  ;['Period', 'Transactions', 'Verified Collection (₹)'].forEach((h, i) => {
    const c = header.getCell(i + 1)
    c.value = h
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } }
  })

  const map = new Map<string, { count: number; sum: number }>()
  let grand = 0
  for (const p of payments) {
    if (!VERIFIED_STATUSES.includes(p.status)) continue
    const at = p.paymentDate ?? p.paidAt ?? p.createdAt
    const key = type === 'DAILY' ? istDayKey(at) : type === 'MONTHLY' ? istMonthKey(at) : istYearKey(at)
    const agg = map.get(key) ?? { count: 0, sum: 0 }
    agg.count++; agg.sum += p.amount
    map.set(key, agg)
    grand += p.amount
  }
  const keys = [...map.keys()].sort()
  keys.forEach((k, i) => {
    const row = ws.getRow(5 + i)
    row.getCell(1).value = k
    row.getCell(2).value = map.get(k)!.count
    const c = row.getCell(3)
    c.value = map.get(k)!.sum
    c.numFmt = '₹ #,##0.00'
  })
  const tr = ws.getRow(5 + keys.length)
  tr.getCell(1).value = 'TOTAL'
  tr.getCell(1).font = { bold: true }
  const tc = tr.getCell(3)
  tc.value = grand
  tc.numFmt = '₹ #,##0.00'
  tc.font = { bold: true }

  ws.getColumn(1).width = 18
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 26
}

function buildCustomerSheet(wb: ExcelJS.Workbook, payments: PaymentRow[], range: { label: string }) {
  const ws = wb.addWorksheet('Customer-wise', { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.mergeCells('A1:D1')
  ws.getCell('A1').value = 'BANDHAN — Customer-wise Transactions'
  ws.getCell('A1').font = { size: 15, bold: true, color: { argb: 'FF7C2D12' } }
  ws.getCell('A2').value = `Range: ${range.label} | Verified payments only`
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF78716C' } }

  const header = ws.getRow(4)
  ;['Customer Name', 'Mobile', 'Transactions', 'Verified Total (₹)'].forEach((h, i) => {
    const c = header.getCell(i + 1)
    c.value = h
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } }
  })

  const map = new Map<string, { name: string; phone: string; count: number; sum: number }>()
  for (const p of payments) {
    if (!VERIFIED_STATUSES.includes(p.status)) continue
    const key = p.id.includes(p.userName ?? '') ? p.userName ?? p.id : p.userName ?? p.id
    const agg = map.get(key) ?? { name: p.userName ?? '—', phone: p.userPhone ?? '—', count: 0, sum: 0 }
    agg.count++; agg.sum += p.amount
    map.set(key, agg)
  }
  const entries = [...map.entries()].sort((a, b) => b[1].sum - a[1].sum)
  entries.forEach(([_, agg], i) => {
    const row = ws.getRow(5 + i)
    row.getCell(1).value = agg.name
    row.getCell(2).value = agg.phone
    row.getCell(3).value = agg.count
    const c = row.getCell(4)
    c.value = agg.sum
    c.numFmt = '₹ #,##0.00'
  })
  ws.getColumn(1).width = 24
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 14
  ws.getColumn(4).width = 20
}

function reportTitle(type: string): string {
  const titles: Record<string, string> = {
    COMPLETE: 'Complete Revenue Report',
    MATRIMONY: 'Matrimony Revenue',
    BUSINESS: 'Business Revenue',
    JOBS: 'Jobs Revenue',
    DIRECTORY: 'Directory Revenue',
    HERO_AD: 'Hero Advertisement Revenue',
    OTHER: 'Other Revenue',
    PENDING: 'Pending Payments',
    APPROVED: 'Approved Payments',
    REJECTED: 'Rejected Payments',
    CUSTOMER: 'Customer-wise Transactions',
    DAILY: 'Daily Collection',
    MONTHLY: 'Monthly Collection',
    YEARLY: 'Yearly Collection',
  }
  return titles[type] ?? type
}
