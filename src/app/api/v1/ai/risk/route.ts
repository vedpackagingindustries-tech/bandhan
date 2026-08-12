import { success, error, serverError } from '@/lib/api-response'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'
import { assessRisk } from '@/services/ai/risk-detection'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

/**
 * AI Risk Assessment
 * POST /api/v1/ai/risk — Assess risk for a target
 * GET /api/v1/ai/risk — Get risk assessments (admin)
 */

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    // Only admin can trigger risk assessment
    const role = (result.auth as any).user?.role;
    if (!role || role.level < 4) {
      return error('Admin access required', 403)
    }

    const body = await request.json()
    const { targetType, targetId, userId } = body
    if (!targetType || !targetId) return error('targetType and targetId are required')

    // Auto-collect signals based on target type
    const { collectRegistrationSignals, collectContentRiskSignals } = await import('@/services/ai/risk-detection')
    let signals: { type: string; description: string; weight: number }[] = []

    if (targetType === 'USER' && userId) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, ipAddress: true } })
      signals = await collectRegistrationSignals({
        userId,
        email: user?.email || undefined,
        phone: user?.phone || undefined,
        ipAddress: user?.ipAddress || undefined,
      })
    } else if (userId) {
      signals = await collectContentRiskSignals({ userId, targetType, targetId })
    }

    const riskResult = await assessRisk({
      userId,
      targetType,
      targetId,
      signals,
    })

    return success(riskResult)
  } catch (err) {
    console.error('[AI RISK] Error:', err)
    return serverError('Risk assessment failed')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const riskLevel = searchParams.get('riskLevel') || undefined
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'))
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = {}
    if (riskLevel) (where as Record<string, unknown>).riskLevel = riskLevel

    const [items, total] = await Promise.all([
      db.riskAssessment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.riskAssessment.count({ where }),
    ])

    return success({ items, total, page: Math.floor(offset / limit) + 1, limit })
  } catch (err) {
    console.error('[AI RISK] GET Error:', err)
    return serverError('Failed to get risk assessments')
  }
}
