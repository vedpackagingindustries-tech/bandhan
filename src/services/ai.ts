// ═══════════════════════════════════════════════════════════
// AI SERVICE — LEGACY COMPATIBILITY LAYER
// Delegates to Phase 4 AI Intelligence Layer.
// These functions maintain backward compatibility with
// existing API routes that import from '@/services/ai'.
// ═══════════════════════════════════════════════════════════

import { matchProfiles } from './ai/match-engine'
import { moderateImage } from './ai/moderation'
import { getRecommendations } from './ai/recommendations'
import { assistantChat } from './ai/assistant'
import { runRegistrationWorkflow } from './ai/automation'
import { assessRisk, collectRegistrationSignals } from './ai/risk-detection'

/**
 * AI Match: compatibility scoring between two profiles.
 * Now delegates to production Match Engine 2.0.
 */
export async function aiMatchProfile(params: {
  profileIdA: string
  profileIdB: string
}): Promise<{
    score: number
    factors: { name: string; weight: number; match: boolean }[]
  }> {
  const result = await matchProfiles({ profileIdA: params.profileIdA, profileIdB: params.profileIdB })
  return {
    score: result.overallScore,
    factors: result.factors.map(f => ({ name: f.name, weight: f.weight, match: f.matched })),
  }
}

/**
 * AI Astrology: kundli matching.
 * Kept as deterministic fallback (Vedic astrology API not yet connected).
 */
export async function aiAstrologyMatch(params: {
  profileIdA: string
  profileIdB: string
  birthDetailsA?: { date: string; time: string; place: string }
  birthDetailsB?: { date: string; time: string; place: string }
}): Promise<{
    totalScore: number
    manglikCheck: boolean
    details: { guna: string; score: number; maxScore: number }[]
  }> {
  console.log(`[AI] Astrology match requested — deterministic fallback`)
  return {
    totalScore: 0,
    manglikCheck: false,
    details: [
      { guna: 'Varna', score: 0, maxScore: 1 },
      { guna: 'Vashya', score: 0, maxScore: 2 },
      { guna: 'Tara', score: 0, maxScore: 3 },
      { guna: 'Yoni', score: 0, maxScore: 4 },
      { guna: 'GrahaMaitri', score: 0, maxScore: 5 },
      { guna: 'Gana', score: 0, maxScore: 6 },
      { guna: 'Bhakoot', score: 0, maxScore: 7 },
      { guna: 'Nadi', score: 0, maxScore: 8 },
    ],
  }
}

/**
 * AI Photo Moderation: delegates to Phase 4 moderation pipeline.
 */
export async function aiModerateImage(params: {
  mediaId: string
  imageUrl: string
}): Promise<{
    approved: boolean
    confidence: number
    flags: string[]
  }> {
  const result = await moderateImage({ mediaId: params.mediaId, imageUrl: params.imageUrl })
  return {
    approved: result.verdict === 'SAFE',
    confidence: result.confidence,
    flags: result.flags.map(f => f.category),
  }
}

/**
 * AI Recommendations: delegates to Phase 4 recommendation engine.
 */
export async function aiGetRecommendations(params: {
  userId: string
  type: 'PROFILES' | 'BUSINESSES' | 'JOBS'
  limit?: number
}): Promise<{
    items: { id: string; score: number; reason: string }[]
  }> {
  const typeMap = { PROFILES: 'MATRIMONY' as const, BUSINESSES: 'BUSINESS' as const, JOBS: 'JOB' as const }
  const result = await getRecommendations({
    userId: params.userId,
    type: typeMap[params.type],
    limit: params.limit || 10,
  })
  return {
    items: result.items.map(item => ({
      id: item.id,
      score: item.score,
      reason: item.reason,
    })),
  }
}

/**
 * AI Assistant: delegates to Phase 4 Bandhan AI Assistant.
 */
export async function aiAssistantChat(params: {
  userId: string
  message: string
  context?: string[]
}): Promise<{ response: string; sources?: string[] }> {
  // Get user's locale and membership tier
  const { db } = await import('@/lib/db')
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { membershipTier: true, profile: { select: { displayName: true } } },
  })

  const result = await assistantChat({
    context: {
      userId: params.userId,
      locale: 'en' as const,
      membershipTier: user?.membershipTier || 'FREE',
      userName: user?.profile?.displayName || undefined,
    },
    message: params.message,
  })

  return { response: result.response }
}

/**
 * AI Auto-Approval: delegates to Phase 4 automation + risk detection.
 */
export async function aiAutoApproval(params: {
  userId: string
}): Promise<{
    approved: boolean
    confidence: number
    checks: { name: string; passed: boolean; details: string }[]
  }> {
  console.log(`[AI] Auto-approval check for ${params.userId} — Phase 4 automation`)

  const { db } = await import('@/lib/db')
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { email: true, phone: true, ipAddress: true },
  })

  if (!user) {
    return {
      approved: false, confidence: 0,
      checks: [{ name: 'user_not_found', passed: false, details: 'User not found' }],
    }
  }

  // Run registration workflow
  const workflow = await runRegistrationWorkflow({
    userId: params.userId,
    email: user.email || undefined,
    phone: user.phone || undefined,
    ipAddress: user.ipAddress || undefined,
  })

  const riskStep = workflow.steps.find(s => s.step === 'risk_analysis')
  const isLowRisk = riskStep?.result?.includes('LOW') || false

  return {
    approved: isLowRisk && !workflow.humanReviewRequired,
 confidence: isLowRisk ? 0.8 : 0.3,
    checks: workflow.steps.map(s => ({
      name: s.step,
      passed: s.status === 'COMPLETED',
      details: s.result || 'Processed',
    })),
  }
}
