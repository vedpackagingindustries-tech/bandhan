// ═══════════════════════════════════════════════════════════
// AI PHOTO MODERATION PIPELINE
// Every uploaded image is eligible for moderation.
// Results: SAFE / REVIEW / BLOCKED
// Evidence is preserved — never auto-deleted.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import type { ModerationResult as ModerationResultType, ModerationVerdict, ModerationFlag, ModerationAutoAction } from './types'
import { executeVision } from './provider'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

const MODERATION_PROMPT = `Analyze this image for a community matrimonial platform (Sahu Samaj Connect, India).

Check for:
1. Nudity or sexual content
2. Extreme vulgarity or offensive imagery
3. Violence or graphic content
4. Suspicious or fraudulent indicators (stock photos, celebrity photos, AI-generated faces)
5. Whether this is an appropriate profile photo

Respond ONLY in valid JSON:
{
  "verdict": "SAFE" | "REVIEW" | "BLOCKED",
  "confidence": 0.0-1.0,
  "flags": [{"category": "string", "confidence": 0.0-1.0, "description": "string"}],
  "isProfilePhoto": true/false,
  "isSuspicious": true/false
}

Be conservative — when in doubt, flag for REVIEW rather than approving.`

/**
 * Moderate an uploaded image.
 * Creates audit trail and moderation record.
 */
export async function moderateImage(params: {
  mediaId: string
  imageUrl: string
  userId?: string
}): Promise<ModerationResultType> {
  const startMs = Date.now()

  // Check existing moderation result (dedup)
  const existing = await db.moderationResult.findUnique({ where: { mediaId: params.mediaId } })
  if (existing) {
    return {
      mediaId: params.mediaId,
      verdict: existing.verdict as ModerationVerdict,
      confidence: existing.confidence,
      flags: JSON.parse(existing.flags || '[]') as ModerationFlag[],
      autoAction: existing.autoAction as ModerationAutoAction,
    }
  }

  // Default result (safe fallback)
  let result: ModerationResultType = {
    mediaId: params.mediaId,
    verdict: 'SAFE',
    confidence: 0.5,
    flags: [],
    autoAction: 'NONE',
  }

  // Try AI vision moderation
  let provider = 'ZAI'
  let model: string | undefined
  let inputTokens = 0
  let outputTokens = 0
  let success = false

  try {
    const visionResult = await executeVision({
      imageUrl: params.imageUrl,
      prompt: MODERATION_PROMPT,
      maxTokens: 1024,
    })

    if (visionResult.success && visionResult.data?.content) {
 model = visionResult.model
      inputTokens = visionResult.inputTokens || 0
      outputTokens = visionResult.outputTokens || 0

      const parsed = JSON.parse(visionResult.data.content)
      const verdict = (parsed.verdict || 'SAFE').toUpperCase()
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
      const flags = Array.isArray(parsed.flags) ? parsed.flags : []

      let autoAction: ModerationAutoAction = 'NONE'
      if (verdict === 'BLOCKED' && confidence >= 0.8) {
        autoAction = 'HIDE'
      } else if (verdict === 'REVIEW' || (verdict === 'BLOCKED' && confidence < 0.8)) {
        autoAction = 'FLAG_FOR_REVIEW'
      }

      result = {
        mediaId: params.mediaId,
        verdict: verdict as ModerationVerdict,
        confidence,
        flags: flags.map((f: Record<string, unknown>) => ({
          category: String(f.category || 'unknown'),
          confidence: typeof f.confidence === 'number' ? f.confidence : 0.5,
          description: String(f.description || ''),
        })),
        autoAction,
      }

      success = true
    }
  } catch (err) {
    console.error('[MODERATION] AI moderation failed for', params.mediaId, err)
    // On failure, default to REVIEW for safety
    result.verdict = 'REVIEW'
    result.confidence = 0.3
    result.autoAction = 'FLAG_FOR_REVIEW'
    result.flags.push({
      category: 'ai_unavailable',
      confidence: 1.0,
      description: 'AI moderation service unavailable — manual review required',
    })
  }

  // Persist moderation result
  try {
    await db.moderationResult.create({
      data: {
        mediaId: params.mediaId,
        verdict: result.verdict,
        confidence: result.confidence,
        flags: JSON.stringify(result.flags),
        autoAction: result.autoAction,
      },
    })

    // Update media record
    await db.media.update({
      where: { id: params.mediaId },
      data: { aiModerated: true },
    })

    // If BLOCKED, notify admin
    if (result.verdict === 'BLOCKED') {
      const { createNotification } = await import('@/lib/notification')
 const admins = await db.user.findMany({
        include: { role: true },
        where: { role: { name: 'SUPER_ADMIN' }, status: 'ACTIVE' },
      })
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'SYSTEM',
          title: 'Image Blocked by AI Moderation',
          message: `Media ${params.mediaId} was blocked. Flags: ${result.flags.map(f => f.category).join(', ')}`,
          channel: 'IN_APP',
        })
      }
    }
  } catch (err) {
    console.error('[MODERATION] Persistence failed:', err)
  }

  // Audit
  try {
    const aiReq = await createAIRequest({
      userId: params.userId,
      operation: 'MODERATE',
      provider: 'ZAI',
      model,
      inputSummary: `Image moderation: ${params.mediaId}`,
      inputContent: params.mediaId,
    })
    await completeAIRequest({
      requestId: aiReq.id,
      status: success ? 'COMPLETED' : 'FAILED',
      resultStatus: result.verdict,
      confidence: result.confidence,
      durationMs: Date.now() - startMs,
      inputTokens,
      outputTokens,
      results: [{
        operation: 'MODERATE',
        targetType: 'MEDIA',
        targetId: params.mediaId,
        resultJson: JSON.stringify(result),
        score: result.confidence,
      }],
    })
    await recordAIUsage({
      operation: 'MODERATE', provider, model, success,
      inputTokens, outputTokens, latencyMs: Date.now() - startMs,
    })
  } catch { /* non-blocking */ }

  return result
}

/**
 * Admin reviews a moderation result.
 */
export async function reviewModeration(params: {
  mediaId: string
  adminUserId: string
  outcome: 'UPHELD' | 'OVERTURNED' | 'ESCALATED'
}) {
  return db.moderationResult.update({
    where: { mediaId: params.mediaId },
    data: {
      reviewedBy: params.adminUserId,
      reviewedAt: new Date(),
      reviewOutcome: params.outcome,
    },
  })
}

/**
 * Get all moderation results needing review.
 */
export async function getPendingModeration(params: {
 verdict?: string
  limit?: number
  offset?: number
}) {
  const where: Record<string, unknown> = {}
  if (params.verdict) (where as Record<string, unknown>).verdict = params.verdict
  else (where as Record<string, unknown>).reviewOutcome = null

  const [items, total] = await Promise.all([
    db.moderationResult.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 20,
      skip: params.offset || 0,
    }),
    db.moderationResult.count({ where }),
  ])

  return { items, total }
}
