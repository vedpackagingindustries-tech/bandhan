// ═══════════════════════════════════════════════════════════
// AI FRAUD / ABUSE DETECTION
// Risk analysis architecture. Outputs LOW/MEDIUM/HIGH.
// High-risk events notify Super Admin.
// Risk score does NOT auto-punish without policy/approval.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import type { RiskAssessmentResult, RiskLevel } from './types'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

interface RiskContext {
  userId?: string
  targetType: string
  targetId: string
  signals: RiskSignalInput[]
}

interface RiskSignalInput {
  type: string
  description: string
  weight: number
  data?: Record<string, unknown>
}

/**
 * Assess risk for a target (user, business, job, etc.).
 */
export async function assessRisk(params: RiskContext): Promise<RiskAssessmentResult> {
  const startMs = Date.now()

  // Weighted signal aggregation
  let totalWeight = 0
  let weightedScore = 0

  for (const signal of params.signals) {
    const weight = Math.min(100, signal.weight)
    weightedScore += weight
    totalWeight += 100
  }

  const riskScore = totalWeight > 0 ? Math.min(100, Math.round((weightedScore / totalWeight) * 100)) : 0

  let riskLevel: RiskLevel = 'LOW'
  let actionSuggested: RiskAssessmentResult['actionSuggested'] = 'NONE'

  if (riskScore >= 70) {
    riskLevel = 'HIGH'
    actionSuggested = 'NOTIFY_ADMIN'
  } else if (riskScore >= 40) {
    riskLevel = 'MEDIUM'
    actionSuggested = 'FLAG_FOR_REVIEW'
  } else if (riskScore >= 20) {
    riskLevel = 'MEDIUM'
    actionSuggested = 'MONITOR'
  }

  const result: RiskAssessmentResult = {
    riskLevel,
    riskScore,
    signals: params.signals.map(s => ({
      type: s.type,
      description: s.description,
      weight: s.weight,
    })),
    actionSuggested,
  }

  // Persist
  try {
    await db.riskAssessment.create({
      data: {
        userId: params.userId,
        targetType: params.targetType,
        targetId: params.targetId,
        riskLevel,
        riskScore,
        signals: JSON.stringify(params.signals),
        actionTaken: actionSuggested === 'NOTIFY_ADMIN' ? 'NOTIFIED_ADMIN' : actionSuggested === 'FLAG_FOR_REVIEW' ? 'FLAGGED' : 'NONE',
      },
    })

    // Notify admin for HIGH risk
    if (riskLevel === 'HIGH') {
      const admins = await db.user.findMany({
        include: { role: true },
        where: { role: { name: 'SUPER_ADMIN' }, status: 'ACTIVE' },
      })
      const { createNotification } = await import('@/lib/notification')
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'SYSTEM',
          title: 'High Risk Detected',
          message: `High risk (${riskScore}/100) detected for ${params.targetType} ${params.targetId}. Signals: ${params.signals.map(s => s.type).join(', ')}`,
          channel: 'IN_APP',
        })
      }
    }
  } catch (err) {
    console.error('[RISK] Persistence failed:', err)
  }

  // Audit
  try {
    const aiReq = await createAIRequest({
      userId: params.userId,
      operation: 'RISK_ANALYSIS',
      provider: 'ZAI',
      model: 'risk-v1',
      inputSummary: `Risk: ${params.targetType} ${params.targetId}`,
      inputContent: `${params.targetType}:${params.targetId}:${riskScore}`,
    })
    await completeAIRequest({
      requestId: aiReq.id,
      status: 'COMPLETED',
      resultStatus: riskLevel,
      confidence: riskScore / 100,
      durationMs: Date.now() - startMs,
    })
    await recordAIUsage({
      operation: 'RISK_ANALYSIS', provider: 'ZAI', model: 'risk-v1',
      success: true, latencyMs: Date.now() - startMs,
    })
  } catch { /* non-blocking */ }

  return result
}

/**
 * Collect risk signals for a new user registration.
 */
export async function collectRegistrationSignals(params: {
  userId: string
  email?: string
  phone?: string
  ipAddress?: string
}): Promise<RiskSignalInput[]> {
  const signals: RiskSignalInput[] = []

  // Check duplicate email
  if (params.email) {
    const emailCount = await db.user.count({
      where: { email: params.email, status: { not: 'BLOCKED' } },
    })
    if (emailCount > 0) {
      signals.push({ type: 'duplicate_email', description: 'Email already registered', weight: 60 })
    }
  }

  // Check duplicate phone
  if (params.phone) {
    const phoneCount = await db.user.count({
      where: { phone: params.phone, status: { not: 'BLOCKED' } },
    })
    if (phoneCount > 0) {
      signals.push({ type: 'duplicate_phone', description: 'Phone already registered', weight: 60 })
    }
  }

  // Check recent registrations from same IP
  if (params.ipAddress) {
    const recentFromIp = await db.user.count({
      where: {
        ipAddress: params.ipAddress,
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    })
    if (recentFromIp >= 3) {
      signals.push({ type: 'ip_burst', description: `Multiple registrations from same IP (${recentFromIp} in 24h)`, weight: 70 })
    }
  }

  return signals
}

/**
 * Collect risk signals for content (business, job, ad, etc.).
 */
export async function collectContentRiskSignals(params: {
  userId: string
  targetType: string
  targetId: string
  content?: string
}): Promise<RiskSignalInput[]> {
  const signals: RiskSignalInput[] = []

  // Check user report count
  const reportCount = await db.report.count({
    where: { reporterId: params.userId },
  })
  if (reportCount > 5) {
    signals.push({ type: 'frequent_reporter', description: `User has ${reportCount} reports`, weight: 30 })
  }

  // Check if user has been previously flagged
  const prevRisk = await db.riskAssessment.findFirst({
    where: { userId: params.userId, riskLevel: 'HIGH' },
  })
  if (prevRisk) {
    signals.push({ type: 'previous_high_risk', description: 'User previously flagged as high risk', weight: 50 })
  }

  return signals
}