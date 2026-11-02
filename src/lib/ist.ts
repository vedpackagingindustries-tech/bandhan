// ═══════════════════════════════════════════════════════════════
// Asia/Kolkata (IST) timezone helpers — all financial reporting
// uses IST day/month/year boundaries per business requirement.
// ═══════════════════════════════════════════════════════════════

const IST_OFFSET_MS = 5.5 * 3600000

export interface DateRange {
  start: Date
  end: Date
  label: string
}

/** IST day boundaries → UTC Date range */
export function istDayRange(dayStartUtcMs: number): DateRange {
  const start = new Date(dayStartUtcMs - IST_OFFSET_MS)
  const end = new Date(dayStartUtcMs - IST_OFFSET_MS + 86400000 - 1)
  return { start, end, label: new Date(dayStartUtcMs).toISOString().slice(0, 10) }
}

export function istDayKey(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS)
  return ist.toISOString().slice(0, 10)
}

export function istMonthKey(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS)
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`
}

export function istYearKey(d: Date): string {
  return String(new Date(d.getTime() + IST_OFFSET_MS).getUTCFullYear())
}

/** Today's midnight in IST, expressed as UTC ms */
function istMidnightUtcMs(ref = new Date()): number {
  const ist = new Date(ref.getTime() + IST_OFFSET_MS)
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth(), d = ist.getUTCDate()
  return Date.UTC(y, m, d) + IST_OFFSET_MS
}

export type Preset =
  | 'today' | 'yesterday' | 'last7days' | 'last30days'
  | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'all' | 'custom'

export function resolvePreset(preset: string | null, startDate?: string | null, endDate?: string | null): DateRange {
  const todayMid = istMidnightUtcMs()
  const DAY = 86400000

  switch (preset) {
    case 'today':
      return { ...istDayRange(todayMid), label: 'Today' }
    case 'yesterday':
      return { ...istDayRange(todayMid - DAY), label: 'Yesterday' }
    case 'last7days':
      return { start: new Date(todayMid - 6 * DAY), end: new Date(todayMid + DAY - 1), label: 'Last 7 Days' }
    case 'last30days':
      return { start: new Date(todayMid - 29 * DAY), end: new Date(todayMid + DAY - 1), label: 'Last 30 Days' }
    case 'thisMonth': {
      const ist = new Date(todayMid + IST_OFFSET_MS)
      const startMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) + IST_OFFSET_MS
      const endMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1) + IST_OFFSET_MS - 1
      return { start: new Date(startMs), end: new Date(endMs), label: `This Month (${ist.toISOString().slice(0, 7)})` }
    }
    case 'lastMonth': {
      const ist = new Date(todayMid + IST_OFFSET_MS)
      const startMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1) + IST_OFFSET_MS
      const endMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) + IST_OFFSET_MS - 1
      return { start: new Date(startMs), end: new Date(endMs), label: `Last Month (${new Date(startMs).toISOString().slice(0, 7)})` }
    }
    case 'thisYear': {
      const ist = new Date(todayMid + IST_OFFSET_MS)
      const y = ist.getUTCFullYear()
      return { start: new Date(Date.UTC(y, 0, 1) + IST_OFFSET_MS), end: new Date(Date.UTC(y + 1, 0, 1) + IST_OFFSET_MS - 1), label: `This Year (${y})` }
    }
    case 'lastYear': {
      const ist = new Date(todayMid + IST_OFFSET_MS)
      const y = ist.getUTCFullYear() - 1
      return { start: new Date(Date.UTC(y, 0, 1) + IST_OFFSET_MS), end: new Date(Date.UTC(y + 1, 0, 1) + IST_OFFSET_MS - 1), label: `Last Year (${y})` }
    }
    case 'custom': {
      const s = startDate ? new Date(`${startDate}T00:00:00+05:30`) : new Date(0)
      const e = endDate ? new Date(`${endDate}T23:59:59+05:30`) : new Date()
      return { start: s, end: e, label: `Custom (${startDate ?? '…'} → ${endDate ?? '…'})` }
    }
    case 'all':
    default:
      return { start: new Date(0), end: new Date(Date.now() + DAY), label: 'All Time' }
  }
}

/** Verified revenue statuses — PENDING/REJECTED are NEVER counted as revenue */
export const VERIFIED_STATUSES = ['APPROVED', 'SUCCESS']

/** UTC Date range for the current IST day (midnight → 23:59:59.999 IST) */
export function istMidnightRange(ref = new Date()): DateRange {
  const DAY = 86400000
  const ist = new Date(ref.getTime() + IST_OFFSET_MS)
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth(), d = ist.getUTCDate()
  const start = new Date(Date.UTC(y, m, d) + IST_OFFSET_MS)
  const end = new Date(Date.UTC(y, m, d) + IST_OFFSET_MS + DAY - 1)
  return { start, end, label: 'Today' }
}
