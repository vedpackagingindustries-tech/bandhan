import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { NextRequest } from 'next/server'

const VALID_TRACK_TYPES = ['IMPRESSION', 'CLICK']

/**
 * Extract device type from User-Agent string.
 * Simple heuristic: Mobile/Android/iPhone -> MOBILE, Tablet/iPad -> TABLET, else DESKTOP
 */
function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (/tablet|ipad/i.test(ua)) return 'TABLET'
  if (/mobile|android|iphone/i.test(ua)) return 'MOBILE'
  return 'DESKTOP'
}

/**
 * Extract preferred language from Accept-Language header.
 * Falls back to 'en'.
 */
function detectLanguage(acceptLanguage: string | null): string {
  if (!acceptLanguage) return 'en'
  const primary = acceptLanguage.split(',')[0]?.trim()
  if (!primary) return 'en'
  return primary.split('-')[0] || 'en'
}

// ═══════════════════════════════════════════════════════════
// POST — Track ad impression or click (NO auth required)
// Anonymous tracking for impressions and clicks.
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId, type, placement, module } = body as {
      campaignId?: string
      type?: string
      placement?: string
      module?: string
    }

    // Validate required fields
    if (!campaignId || typeof campaignId !== 'string') {
      return error('campaignId is required')
    }
    if (!type || !VALID_TRACK_TYPES.includes(type)) {
      return error(`type must be one of: ${VALID_TRACK_TYPES.join(', ')}`)
    }

    // Verify campaign exists and is ACTIVE
    const campaign = await db.adCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true },
    })

    if (!campaign) {
      return error('Campaign not found', 404)
    }
    if (campaign.status !== 'ACTIVE') {
      return error('Campaign is not active')
    }

    // Get client info
    const { ipAddress, userAgent } = getClientInfo(request)
    const device = detectDevice(userAgent)
    const acceptLanguage = request.headers.get('accept-language')
    const language = detectLanguage(acceptLanguage)

    if (type === 'IMPRESSION') {
      // Create impression record and increment counter atomically via transaction
      await db.$transaction([
        db.adImpression.create({
          data: {
            campaignId,
            ipAddress,
            userAgent,
            device,
            language,
            module: module || null,
            placement: placement || null,
          },
        }),
        db.adCampaign.update({
          where: { id: campaignId },
          data: { impressions: { increment: 1 } },
        }),
      ])
    } else {
      // CLICK
      await db.$transaction([
        db.adClick.create({
          data: {
            campaignId,
            ipAddress,
            userAgent,
            device,
            language,
            module: module || null,
            placement: placement || null,
          },
        }),
        db.adCampaign.update({
          where: { id: campaignId },
          data: { clicks: { increment: 1 } },
        }),
      ])
    }

    return success({ tracked: true, type, campaignId })
  } catch (err) {
    console.error('[AD_TRACK] POST error:', err)
    return serverError('Failed to track ad event')
  }
}

// ═══════════════════════════════════════════════════════════
// GET — Aggregated ad performance data (SuperAdmin only)
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const campaignId = sp.get('campaignId')
    const startDateStr = sp.get('startDate')
    const endDateStr = sp.get('endDate')
    const device = sp.get('device')
    const module_ = sp.get('module')
    const typeParam = sp.get('type') || 'all' // impressions | clicks | all

    // Build base where clause
    const baseWhere: Record<string, unknown> = {}
    if (campaignId) baseWhere.campaignId = campaignId

    // Date range
    if (startDateStr || endDateStr) {
      baseWhere.createdAt = {}
      if (startDateStr) (baseWhere.createdAt as Record<string, unknown>).gte = new Date(startDateStr)
      if (endDateStr) (baseWhere.createdAt as Record<string, unknown>).lte = new Date(endDateStr)
    }

    // Device / module filters
    if (device) baseWhere.device = device
    if (module_) baseWhere.module = module_

    let impressions: Record<string, unknown> = {}
    let clicks: Record<string, unknown> = {}

    if (typeParam === 'impressions' || typeParam === 'all') {
      const [impressionRecords, impressionTotal, byDate, byDevice, byModule] = await Promise.all([
        db.adImpression.findMany({
          where: baseWhere,
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        db.adImpression.count({ where: baseWhere }),
        // Group by date (SQLite date string)
        db.$queryRawUnsafe< Array<{ date: string; _count: number }>>(`
          SELECT substr(createdAt, 1, 10) as date, count(*) as _count
          FROM AdImpression
          ${buildWhereClause(baseWhere)}
          GROUP BY substr(createdAt, 1, 10)
          ORDER BY date DESC
          LIMIT 90
        `),
        // Group by device
        db.adImpression.groupBy({
          by: ['device'],
          where: baseWhere,
          _count: { device: true },
        }),
        // Group by module
        db.adImpression.groupBy({
          by: ['module'],
          where: baseWhere,
          _count: { module: true },
        }),
      ])

      impressions = {
        total: impressionTotal,
        recent: impressionRecords.map((r) => ({
          id: r.id,
          campaignId: r.campaignId,
          device: r.device,
          language: r.language,
          module: r.module,
          placement: r.placement,
          createdAt: r.createdAt.toISOString(),
        })),
        byDate: byDate.map((d) => ({ date: d.date, count: d._count })),
        byDevice: Object.fromEntries(byDevice.filter((d) => d.device).map((d) => [d.device, d._count.device])),
        byModule: Object.fromEntries(byModule.filter((d) => d.module).map((d) => [d.module, d._count.module])),
      }
    }

    if (typeParam === 'clicks' || typeParam === 'all') {
      const [clickRecords, clickTotal, clickByDate, clickByDevice, clickByModule] = await Promise.all([
        db.adClick.findMany({
          where: baseWhere,
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        db.adClick.count({ where: baseWhere }),
        db.$queryRawUnsafe< Array<{ date: string; _count: number }>>(`
          SELECT substr(createdAt, 1, 10) as date, count(*) as _count
          FROM AdClick
          ${buildWhereClause(baseWhere)}
          GROUP BY substr(createdAt, 1, 10)
          ORDER BY date DESC
          LIMIT 90
        `),
        db.adClick.groupBy({
          by: ['device'],
          where: baseWhere,
          _count: { device: true },
        }),
        db.adClick.groupBy({
          by: ['module'],
          where: baseWhere,
          _count: { module: true },
        }),
      ])

      clicks = {
        total: clickTotal,
        recent: clickRecords.map((r) => ({
          id: r.id,
          campaignId: r.campaignId,
          device: r.device,
          language: r.language,
          module: r.module,
          placement: r.placement,
          createdAt: r.createdAt.toISOString(),
        })),
        byDate: clickByDate.map((d) => ({ date: d.date, count: d._count })),
        byDevice: Object.fromEntries(clickByDevice.filter((d) => d.device).map((d) => [d.device, d._count.device])),
        byModule: Object.fromEntries(clickByModule.filter((d) => d.module).map((d) => [d.module, d._count.module])),
      }
    }

    // Compute CTR
    const impTotal = (impressions as Record<string, unknown>).total as number | undefined
    const clkTotal = (clicks as Record<string, unknown>).total as number | undefined
    const ctr = impTotal && impTotal > 0 && clkTotal !== undefined
      ? Math.round((clkTotal / impTotal) * 100 * 100) / 100
      : 0

    return success({ impressions, clicks, ctr })
  } catch (err) {
    console.error('[AD_TRACK] GET error:', err)
    return serverError('Failed to retrieve ad performance data')
  }
}

// ── Helper: Build raw SQL WHERE clause from base where object ──
function buildWhereClause(where: Record<string, unknown>): string {
  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (where.campaignId) {
    conditions.push(`campaignId = $${paramIndex++}`)
    params.push(where.campaignId)
  }
  if (where.device) {
    conditions.push(`device = $${paramIndex++}`)
    params.push(where.device)
  }
  if (where.module) {
    conditions.push(`module = $${paramIndex++}`)
    params.push(where.module)
  }
  if (where.createdAt && typeof where.createdAt === 'object') {
    const dateRange = where.createdAt as Record<string, unknown>
    if (dateRange.gte) {
      conditions.push(`createdAt >= $${paramIndex++}`)
      params.push(new Date(dateRange.gte as string).toISOString())
    }
    if (dateRange.lte) {
      conditions.push(`createdAt <= $${paramIndex++}`)
      params.push(new Date(dateRange.lte as string).toISOString())
    }
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
}
