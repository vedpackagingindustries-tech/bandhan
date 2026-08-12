// ═══════════════════════════════════════════════════════════
// AGENTIC AUTOMATION WORKFLOWS
// Controlled AI automation for content pipelines.
// Respects RBAC, Privacy, Audit, Approval rules.
// Human-in-the-loop for sensitive decisions.
// ═══════════════════════════════════════════════════════════

import type { AutomationResult, AutomationStep, AutomationWorkflowType } from './types'
import { moderateImage } from './moderation'
import { assessRisk, collectRegistrationSignals, collectContentRiskSignals } from './risk-detection'

/**
 * Run the Registration automation workflow.
 */
export async function runRegistrationWorkflow(params: {
  userId: string
  email?: string
  phone?: string
  ipAddress?: string
}): Promise<AutomationResult> {
  const steps: AutomationStep[] = []
  let humanReviewRequired = false
  let reviewReason: string | undefined
  const startMs = Date.now()

  // Step 1: Validation
  const s1Start = Date.now()
  const user = await (await import('@/lib/db')).db.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, phone: true, status: true, ipAddress: true },
  })
  steps.push({
    step: 'validation',
    status: user ? 'COMPLETED' : 'FAILED',
    durationMs: Date.now() - s1Start,
    result: user ? 'User exists' : 'User not found',
  })

  if (!user) {
    return { workflowType: 'REGISTRATION', targetId: params.userId, steps, finalStatus: 'REJECTED', humanReviewRequired: true, reviewReason: 'User not found' }
  }

  // Step 2: Risk Analysis
  const s2Start = Date.now()
  try {
    const riskSignals = await collectRegistrationSignals({
      userId: params.userId,
      email: user.email || params.email,
      phone: user.phone || params.phone,
      ipAddress: params.ipAddress || user.ipAddress || undefined,
    })
    const riskResult = await assessRisk({
      userId: params.userId,
      targetType: 'USER',
      targetId: params.userId,
      signals: riskSignals,
    })
    steps.push({
      step: 'risk_analysis',
      status: 'COMPLETED',
      durationMs: Date.now() - s2Start,
      result: `Risk: ${riskResult.riskLevel} (${riskResult.riskScore}/100)`,
    })
    if (riskResult.riskLevel === 'HIGH') {
      humanReviewRequired = true
      reviewReason = `High risk score: ${riskResult.riskScore}. Signals: ${riskResult.signals.map(s => s.type).join(', ')}`
    }
  } catch (err) {
    steps.push({ step: 'risk_analysis', status: 'FAILED', durationMs: Date.now() - s2Start, result: String(err) })
    humanReviewRequired = true
  }

  // Step 3: Notification
  const s3Start = Date.now()
  try {
    const { createNotification } = await import('@/lib/notification')
    await createNotification({
      userId: params.userId,
      type: 'REGISTRATION',
      title: 'Registration Received',
      message: humanReviewRequired
        ? 'Your registration is under review. We will notify you once approved.'
        : 'Your registration has been received and is being processed.',
      channel: 'IN_APP',
    })
    steps.push({ step: 'notification', status: 'COMPLETED', durationMs: Date.now() - s3Start, result: 'Notified user' })
  } catch (err) {
    steps.push({ step: 'notification', status: 'FAILED', durationMs: Date.now() - s3Start, result: String(err) })
  }

  return {
    workflowType: 'REGISTRATION',
    targetId: params.userId,
    steps,
    finalStatus: 'PENDING_REVIEW', // Registration always requires admin approval
    humanReviewRequired: true,
    reviewReason,
  }
}

/**
 * Run the Content (Business/Job/Ad/Directory/Matrimony) automation workflow.
 */
export async function runContentWorkflow(params: {
  workflowType: Exclude<AutomationWorkflowType, 'REGISTRATION'>
  targetId: string
  userId: string
  contentText?: string
  imageUrl?: string
  mediaId?: string
}): Promise<AutomationResult> {
  const steps: AutomationStep[] = []
  let humanReviewRequired = false
  let reviewReason: string | undefined

  // Step 1: Validation
  const s1Start = Date.now()
  const { db } = await import('@/lib/db')
  const targetExists = await db.user.findUnique({ where: { id: params.userId }, select: { id: true } })
  steps.push({ step: 'validation', status: targetExists ? 'COMPLETED' : 'FAILED', durationMs: Date.now() - s1Start, result: targetExists ? 'User verified' : 'User not found' })
  if (!targetExists) {
    return { workflowType: params.workflowType, targetId: params.targetId, steps, finalStatus: 'REJECTED', humanReviewRequired: true, reviewReason: 'User not found' }
  }

  // Step 2: Risk Analysis
  const s2Start = Date.now()
  try {
    const riskSignals = await collectContentRiskSignals({
      userId: params.userId,
      targetType: params.workflowType,
      targetId: params.targetId,
      content: params.contentText,
    })
    const riskResult = await assessRisk({
      userId: params.userId,
      targetType: params.workflowType,
      targetId: params.targetId,
      signals: riskSignals,
    })
    steps.push({
      step: 'risk_analysis',
      status: 'COMPLETED',
      durationMs: Date.now() - s2Start,
      result: `Risk: ${riskResult.riskLevel} (${riskResult.riskScore}/100)`,
    })
    if (riskResult.riskLevel === 'HIGH') {
      humanReviewRequired = true
      reviewReason = `High risk detected: ${riskResult.signals.map(s => s.type).join(', ')}`
    }
  } catch (err) {
    steps.push({ step: 'risk_analysis', status: 'FAILED', durationMs: Date.now() - s2Start, result: String(err) })
    humanReviewRequired = true
  }

  // Step 3: AI Moderation (if image provided)
  if (params.imageUrl && params.mediaId) {
    const s3Start = Date.now()
    try {
      const modResult = await moderateImage({
        mediaId: params.mediaId,
        imageUrl: params.imageUrl,
        userId: params.userId,
      })
      steps.push({
        step: 'ai_moderation',
        status: 'COMPLETED',
        durationMs: Date.now() - s3Start,
        result: `Verdict: ${modResult.verdict}, Confidence: ${modResult.confidence}`,
      })
      if (modResult.verdict === 'BLOCKED') {
        return {
          workflowType: params.workflowType,
          targetId: params.targetId,
          steps,
          finalStatus: 'REJECTED',
          humanReviewRequired: true,
          reviewReason: `Content blocked by AI moderation. Flags: ${modResult.flags.map(f => f.category).join(', ')}`,
        }
      }
      if (modResult.verdict === 'REVIEW') {
        humanReviewRequired = true
        reviewReason = reviewReason ? `${reviewReason}. Content flagged for manual review.` : 'Content flagged for manual review by AI.'
      }
    } catch (err) {
      steps.push({ step: 'ai_moderation', status: 'FAILED', durationMs: Date.now() - s3Start, result: String(err) })
    }
  }

  return {
    workflowType: params.workflowType,
    targetId: params.targetId,
    steps,
    finalStatus: humanReviewRequired ? 'PENDING_REVIEW' : 'APPROVED',
    humanReviewRequired,
    reviewReason,
  }
}
