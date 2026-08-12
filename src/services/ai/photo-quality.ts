// ═══════════════════════════════════════════════════════════
// AI PHOTO QUALITY ANALYSIS
// Analyzes profile photos for quality issues.
// Does NOT automatically reject — only provides recommendations.
// ═══════════════════════════════════════════════════════════

import type { PhotoQualityResult, PhotoQualityIssue } from './types'
import { executeVision } from './provider'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

const QUALITY_PROMPT = `Analyze this profile photo for quality issues.

Check for:
1. BLUR — Is the image blurry or out of focus?
2. LOW_RESOLUTION — Is the resolution too low for a profile photo? (below 200x200)
3. POOR_LIGHTING — Is the lighting too dark, too bright, or uneven?
4. OBSTRUCTION — Is the face obstructed by sunglasses, masks, objects, or other people?
5. DUPLICATE — Could this be a stock photo or copied from elsewhere?
6. INVALID_PROFILE_IMAGE — Is this not a person's photo at all? (landscape, text, logo, cartoon)

Respond ONLY in valid JSON:
{
  "overallQuality": "GOOD" | "ACCEPTABLE" | "POOR",
  "issues": [{"type": "BLUR|LOW_RESOLUTION|POOR_LIGHTING|OBSTRUCTION|DUPLICATE|INVALID_PROFILE_IMAGE", "severity": "LOW|MEDIUM|HIGH", "description": "string", "descriptionHi": "string"}],
  "recommendations": ["string"],
  "recommendationsHi": ["string"]
}

Be constructive. Do not reject based on aesthetics.`

/**
 * Analyze photo quality.
 */
export async function analyzePhotoQuality(params: {
  mediaId: string
  imageUrl: string
  width?: number
  height?: number
  userId?: string
  locale?: 'en' | 'hi'
}): Promise<PhotoQualityResult> {
  const startMs = Date.now()
  const locale = params.locale || 'en'

  // Default result
  const defaultResult: PhotoQualityResult = {
    mediaId: params.mediaId,
    overallQuality: 'ACCEPTABLE',
    issues: [],
    recommendations: [],
    recommendationsHi: [],
  }

  // Quick deterministic checks (no AI needed)
  const issues: PhotoQualityIssue[] = []

  if (params.width && params.height) {
    if (params.width < 200 || params.height < 200) {
      issues.push({
        type: 'LOW_RESOLUTION', severity: 'HIGH',
        description: `Resolution ${params.width}x${params.height} is too low`,
        descriptionHi: `रिज़ॉल्यूशन ${params.width}x${params.height} बहुत कम है`,
      })
    }
  }

  // If we already found HIGH severity issues, return early with deterministic result
  if (issues.some(i => i.severity === 'HIGH')) {
    return {
      mediaId: params.mediaId,
      overallQuality: 'POOR',
      issues,
      recommendations: ['Upload a higher resolution photo'],
      recommendationsHi: ['उच्च रिज़ॉल्यूशन फ़ोटो अपलोड करें'],
    }
  }

  // AI analysis
  try {
    const result = await executeVision({
      imageUrl: params.imageUrl,
      prompt: QUALITY_PROMPT,
      maxTokens: 1024,
    })

    if (result.success && result.data?.content) {
      const parsed = JSON.parse(result.data.content)
      const aiIssues = Array.isArray(parsed.issues)
        ? parsed.issues.filter((i: Record<string, unknown>) => i.type && i.severity)
        : []

      return {
        mediaId: params.mediaId,
        overallQuality: parsed.overallQuality || 'ACCEPTABLE',
        issues: aiIssues.map((i: Record<string, unknown>) => ({
          type: i.type as PhotoQualityIssue['type'],
          severity: i.severity as PhotoQualityIssue['severity'],
          description: String(i.description || ''),
          descriptionHi: String(i.descriptionHi || ''),
        })),
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
        recommendationsHi: Array.isArray(parsed.recommendationsHi) ? parsed.recommendationsHi.map(String) : [],
      }
    }
  } catch (err) {
    console.error('[PHOTO_QUALITY] AI analysis failed:', err)
  }

  // Audit
  try {
    const aiReq = await createAIRequest({
      userId: params.userId,
      operation: 'ANALYZE',
      provider: 'ZAI',
      model: 'photo-quality',
      inputSummary: `Photo quality: ${params.mediaId}`,
      inputContent: params.mediaId,
    })
    await completeAIRequest({
      requestId: aiReq.id,
      status: 'COMPLETED',
      durationMs: Date.now() - startMs,
    })
    await recordAIUsage({
      operation: 'ANALYZE', provider: 'ZAI', model: 'photo-quality',
      success: true, latencyMs: Date.now() - startMs,
    })
  } catch { /* non-blocking */ }

  return defaultResult
}
