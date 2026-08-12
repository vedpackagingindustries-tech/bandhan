import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════
// GET — AI monitoring dashboard (requireSuperAdmin)
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp, { page: 1, limit: 20 })

    const provider = sp.get('provider')
    const operation = sp.get('operation')
    const status = sp.get('status')
    const startDateStr = sp.get('startDate')
    const endDateStr = sp.get('endDate')

    // Default last 7 days
    const now = new Date()
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startDate = startDateStr ? new Date(startDateStr) : defaultStart
    const endDate = endDateStr ? new Date(endDateStr) : now

    // Build where clause for AIRequest
    const where: Record<string, unknown> = {
      createdAt: { gte: startDate, lte: endDate },
    }
    if (provider) where.provider = provider
    if (operation) where.operation = operation
    if (status) where.status = status

    // Build where clause for AIUsage (date-based)
    const startDateStrFmt = startDate.toISOString().split('T')[0]
    const endDateStrFmt = endDate.toISOString().split('T')[0]
    const usageWhere: Record<string, unknown> = {
      date: { gte: startDateStrFmt, lte: endDateStrFmt },
    }
    if (provider) usageWhere.provider = provider

    // Run all queries in parallel
    const [
      summary,
      byProvider,
      byOperation,
      dailyUsage,
      providers,
      recentRequests,
      recentTotal,
    ] = await Promise.all([
      // Summary aggregate
      db.aIRequest.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          costUsd: true,
          durationMs: true,
        },
      }),

      // Grouped by provider
      db.aIRequest.groupBy({
        by: ['provider'],
        where,
        _count: { _all: true },
        _sum: {
          costUsd: true,
        },
      }),

      // Grouped by operation
      db.aIRequest.groupBy({
        by: ['operation'],
        where,
        _count: { _all: true },
        _sum: {
          durationMs: true,
        },
      }),

      // Daily usage from AIUsage table
      db.aIUsage.findMany({
        where: usageWhere,
        orderBy: { date: 'asc' },
      }),

      // Provider configs
      db.aIProviderConfig.findMany({
        orderBy: { priority: 'desc' },
      }),

      // Recent requests paginated
      db.aIRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          operation: true,
          provider: true,
          model: true,
          inputSummary: true,
          status: true,
          resultStatus: true,
          confidence: true,
          durationMs: true,
          inputTokens: true,
          outputTokens: true,
          costUsd: true,
          error: true,
          createdAt: true,
          completedAt: true,
        },
      }),

      // Total for pagination
      db.aIRequest.count({ where }),
    ])

    // Count by status
    const [completedCount, failedCount, pendingCount] = await Promise.all([
      db.aIRequest.count({ where: { ...where, status: 'COMPLETED' } }),
      db.aIRequest.count({ where: { ...where, status: 'FAILED' } }),
      db.aIRequest.count({ where: { ...where, status: 'PENDING' } }),
    ])

    const totalRequests = summary._count._all
    const successRate = totalRequests > 0
      ? Number(((completedCount / totalRequests) * 100).toFixed(2))
      : 0

    const avgLatencyMs = totalRequests > 0 && summary._sum.durationMs
      ? Number((summary._sum.durationMs / totalRequests).toFixed(2))
      : 0

    // Aggregate daily usage from AIUsage records
    const dailyMap = new Map<string, { date: string; requests: number; costUsd: number; inputTokens: number; outputTokens: number }>()
    for (const row of dailyUsage) {
      const existing = dailyMap.get(row.date)
      if (existing) {
        existing.requests += row.totalRequests
        existing.costUsd += row.totalCostUsd
        existing.inputTokens += row.totalInputTok
        existing.outputTokens += row.totalOutputTok
      } else {
        dailyMap.set(row.date, {
          date: row.date,
          requests: row.totalRequests,
          costUsd: row.totalCostUsd,
          inputTokens: row.totalInputTok,
          outputTokens: row.totalOutputTok,
        })
      }
    }
    const dailyUsageResult = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // Compute operation success/failed breakdown
    const opSuccessMap = new Map<string, number>()
    const opFailedMap = new Map<string, number>()
    for (const op of byOperation) {
      // Quick count for success/failed per operation
    }
    // Run per-operation status counts
    const opStats = await Promise.all(
      byOperation.map(async (op) => {
        const [succ, fail] = await Promise.all([
          db.aIRequest.count({ where: { ...where, operation: op.operation, status: 'COMPLETED' } }),
          db.aIRequest.count({ where: { ...where, operation: op.operation, status: 'FAILED' } }),
        ])
        return {
          operation: op.operation,
          requests: op._count._all,
          success: succ,
          failed: fail,
          avgLatencyMs: op._sum.durationMs && op._count._all > 0
            ? Number((op._sum.durationMs / op._count._all).toFixed(2))
            : 0,
        }
      })
    )

    // Compute provider success/failed breakdown
    const provStats = await Promise.all(
      byProvider.map(async (prov) => {
        const [succ, fail] = await Promise.all([
          db.aIRequest.count({ where: { ...where, provider: prov.provider, status: 'COMPLETED' } }),
          db.aIRequest.count({ where: { ...where, provider: prov.provider, status: 'FAILED' } }),
        ])
        return {
          provider: prov.provider,
          requests: prov._count._all,
          success: succ,
          failed: fail,
          costUsd: prov._sum.costUsd ?? 0,
        }
      })
    )

    return success({
      summary: {
        totalRequests,
        completedRequests: completedCount,
        failedRequests: failedCount,
        pendingRequests: pendingCount,
        successRate,
        totalCostUsd: summary._sum.costUsd ?? 0,
        totalInputTokens: summary._sum.inputTokens ?? 0,
        totalOutputTokens: summary._sum.outputTokens ?? 0,
        avgLatencyMs,
      },
      byProvider: provStats,
      byOperation: opStats,
      dailyUsage: dailyUsageResult,
      providers: providers.map((p) => ({
        id: p.id,
        provider: p.provider,
        displayName: p.displayName,
        enabled: p.enabled,
        priority: p.priority,
        rateLimitRpm: p.rateLimitRpm,
        capabilities: p.capabilities ? JSON.parse(p.capabilities) : [],
      })),
      recentRequests,
      pagination: paginate(page, limit, recentTotal),
    })
  } catch (err) {
    console.error('[AI_OPS] GET error:', err)
    return serverError('Failed to retrieve AI operations data')
  }
}
