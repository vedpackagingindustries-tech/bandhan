import { db } from '@/lib/db'
import { unauthorized, success, error, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * AI Auto-Approval System
 * 
 * Workflow:
 * 1. User registers → status PENDING_APPROVAL
 * 2. Super Admin notified
 * 3. If no response within 2 hours → AI verification ready
 * 4. Admin can trigger AI check manually or it runs automatically
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams, { page: 1, limit: 20 })

    // Find users pending for more than 2 hours (AI-eligible)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const [pendingUsers, total] = await Promise.all([
      db.user.findMany({
        where: {
          status: 'PENDING_APPROVAL',
          createdAt: { lt: twoHoursAgo },
          role: { name: { not: 'SUPER_ADMIN' } },
        },
        include: {
          profile: { select: { firstName: true, lastName: true, displayName: true, city: true } },
          otpVerifications: { where: { verified: true }, select: { type: true, method: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      db.user.count({
        where: {
          status: 'PENDING_APPROVAL',
          createdAt: { lt: twoHoursAgo },
          role: { name: { not: 'SUPER_ADMIN' } },
        },
      }),
    ])

    // Also get recent AI-processed approvals
    const aiProcessed = await db.approval.findMany({
      where: { aiProcessed: true },
      include: {
        user: { select: { id: true, email: true, status: true, profile: { select: { firstName: true, lastName: true } } } },
        reviewer: { select: { profile: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { reviewedAt: 'desc' },
      take: 10,
    })

    return success({
      eligibleForAI: pendingUsers,
      aiProcessed,
      summary: {
        totalEligible: total,
        totalAIProcessed: aiProcessed.length,
      },
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[AI APPROVAL] Error:', err)
    return error('Failed to fetch AI approval data')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { userId, action } = body as { userId: string; action: 'TRIGGER_AI_CHECK' | 'AUTO_APPROVE' | 'MANUAL_REVIEW' }

    if (!userId || !action) return error('User ID and action are required')

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return error('User not found', 404)
    if (user.status !== 'PENDING_APPROVAL') return error('User is not pending approval')

    const { ipAddress, userAgent } = getClientInfo(request)

    if (action === 'TRIGGER_AI_CHECK') {
      // Call AI verification service
      const { aiAutoApproval } = await import('@/services/ai')
      const aiResult = await aiAutoApproval({ userId })

      await logAudit({
        userId: auth.userId,
        action: 'admin.ai_approval_check',
        entity: 'User',
        entityId: userId,
        details: { aiResult },
        ipAddress,
        userAgent,
      })

      return success({
        userId,
        aiResult,
        message: aiResult.approved ? 'AI recommends approval' : 'AI recommends manual review',
      })
    }

    if (action === 'AUTO_APPROVE') {
      await db.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } })

      await db.approval.create({
        data: {
          userId,
          action: 'APPROVE',
          reason: 'Auto-approved by AI',
          reviewedBy: auth.userId,
          status: 'APPROVED',
          aiProcessed: true,
          reviewedAt: new Date(),
        },
      })

      const { createNotification } = await import('@/lib/notification')
      await createNotification({
        userId,
        type: 'APPROVAL',
        title: 'Account Approved',
        message: 'Your account has been approved. Welcome to Bandhan!',
      })

      await logAudit({
        userId: auth.userId,
        action: 'admin.ai_auto_approve',
        entity: 'User',
        entityId: userId,
        ipAddress,
        userAgent,
      })

      return success({ message: 'User auto-approved' })
    }

    return error('Invalid action')
  } catch (err) {
    console.error('[AI APPROVAL ACTION] Error:', err)
    return error('AI approval action failed')
  }
}
