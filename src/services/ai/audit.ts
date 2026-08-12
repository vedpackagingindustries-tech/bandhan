// ═══════════════════════════════════════════════════════════
// AI AUDIT LOGGING
// Every AI operation is recorded for transparency, cost
// tracking, security, and debugging.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import type { AIOperation, AIProviderName } from './types'
import crypto from 'crypto'

/**
 * Create an AI request audit record.
 */
export async function createAIRequest(params: {
  userId?: string
  operation: AIOperation
  provider: AIProviderName
  model?: string
  inputSummary?: string
  inputContent?: string  // For hash/dedup — NOT stored in plain text
}) {
  const inputHash = params.inputContent
    ? crypto.createHash('sha256').update(params.inputContent).digest('hex').slice(0, 32)
    : null

  // Check for duplicate within last 60 seconds
  if (inputHash) {
    const recent = await db.aIRequest.findFirst({
      where: {
        inputHash,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    })
    if (recent) return recent
  }

  return db.aIRequest.create({
    data: {
      userId: params.userId,
      operation: params.operation,
      provider: params.provider,
      model: params.model,
      inputSummary: params.inputSummary?.slice(0, 500),
      inputHash,
      status: 'PROCESSING',
    },
  })
}

/**
 * Complete an AI request record with results.
 */
export async function completeAIRequest(params: {
  requestId: string
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED'
  resultStatus?: string
  confidence?: number
  durationMs: number
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  error?: string
  results?: { operation: string; targetType?: string; targetId?: string; resultJson: string; score?: number; metadata?: string }[]
}) {
  const updateData: Record<string, unknown> = {
    status: params.status,
    resultStatus: params.resultStatus,
    confidence: params.confidence,
    durationMs: params.durationMs,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costUsd: params.costUsd,
    error: params.error?.slice(0, 2000),
    completedAt: new Date(),
  }

  const requestId = params.requestId
  await db.aIRequest.update({ where: { id: requestId }, data: updateData })

  // Create result records
  if (params.results && params.results.length > 0) {
    await db.aIResult.createMany({
      data: params.results.map(r => ({
        requestId,
        operation: r.operation,
        targetType: r.targetType,
        targetId: r.targetId,
        resultJson: typeof r.resultJson === 'string' ? r.resultJson : JSON.stringify(r.resultJson),
        score: r.score,
        metadata: r.metadata ? (typeof r.metadata === 'string' ? r.metadata : JSON.stringify(r.metadata)) : null,
      })),
    })
  }
}

/**
 * Record AI usage for analytics aggregation.
 */
export async function recordAIUsage(params: {
  operation: AIOperation
  provider: AIProviderName
  model?: string
  success: boolean
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  latencyMs: number
}) {
  const today = new Date().toISOString().split('T')[0]

  try {
    await db.aIUsage.upsert({
      where: {
        date_operation_provider_model: {
          date: today,
          operation: params.operation,
          provider: params.provider,
          model: params.model || '',
        },
      },
      create: {
        date: today,
        operation: params.operation,
        provider: params.provider,
        model: params.model || '',
        totalRequests: 1,
        successCount: params.success ? 1 : 0,
        failCount: params.success ? 0 : 1,
        totalInputTok: params.inputTokens || 0,
        totalOutputTok: params.outputTokens || 0,
        totalCostUsd: params.costUsd || 0,
        avgLatencyMs: params.latencyMs,
      },
      update: {
        totalRequests: { increment: 1 },
        successCount: params.success ? { increment: 1 } : undefined,
        failCount: params.success ? undefined : { increment: 1 },
        totalInputTok: { increment: params.inputTokens || 0 },
        totalOutputTok: { increment: params.outputTokens || 0 },
        totalCostUsd: { increment: params.costUsd || 0 },
        avgLatencyMs: params.latencyMs,
      },
    })
  } catch (err) {
    console.error('[AI_AUDIT] Usage recording failed:', err)
  }
}

/**
 * Get AI analytics summary for admin.
 */
export async function getAIAnalytics(params?: { days?: number }) {
  const days = params?.days || 30
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

  const [usageData, recentRequests, errorCount] = await Promise.all([
    db.aIUsage.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'desc' },
    }),
    db.aIRequest.findMany({
      where: { createdAt: { gte: new Date(since) } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        operation: true,
        provider: true,
        model: true,
        status: true,
        resultStatus: true,
        confidence: true,
        durationMs: true,
        inputTokens: true,
        outputTokens: true,
        costUsd: true,
        createdAt: true,
      },
    }),
    db.aIRequest.count({
      where: {
        createdAt: { gte: new Date(since) },
        status: 'FAILED',
      },
    }),
  ])

  const totals = usageData.reduce(
    (acc, u) => {
      acc.totalRequests += u.totalRequests
      acc.successCount += u.successCount
      acc.failCount += u.failCount
      acc.totalInputTok += u.totalInputTok
      acc.totalOutputTok += u.totalOutputTok
      acc.totalCostUsd += u.totalCostUsd
      return acc
    },
    { totalRequests: 0, successCount: 0, failCount: 0, totalInputTok: 0, totalOutputTok: 0, totalCostUsd: 0 }
  )

  return {
    period: { days, since },
    totals,
    successRate: totals.totalRequests > 0 ? (totals.successCount / totals.totalRequests) * 100 : 0,
    recentRequests,
    errorCount,
    usageByDay: usageData.map(u => ({
      date: u.date,
      requests: u.totalRequests,
      cost: u.totalCostUsd,
    })),
  }
}
