import { db } from '@/lib/db'
import { success, error, forbidden, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/admin/users — List all users with filters (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const role = searchParams.get('role')
    const membershipTier = searchParams.get('membershipTier')
    const search = searchParams.get('search')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (membershipTier) where.membershipTier = membershipTier
    if (role) where.role = { name: role }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          membershipTier: true,
          registrationCategory: true,
          emailVerified: true,
          phoneVerified: true,
          mustChangePassword: true,
          lastLoginAt: true,
          loginCount: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          createdAt: true,
          role: { select: { id: true, name: true, displayName: true } },
          profile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              gender: true,
              city: true,
              state: true,
              profilePhotoUrl: true,
            },
          },
          _count: {
            select: { sessions: true, auditLogs: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[ADMIN USERS GET] Error:', err)
    return error('Failed to fetch users')
  }
}

/**
 * PATCH /api/v1/admin/users — Update user status/role (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const body = await request.json()
    const { userId, action, reason } = body

    if (!userId || !action) return error('userId and action are required')

    const validActions = ['APPROVE', 'REJECT', 'BLOCK', 'UNBLOCK', 'DEACTIVATE', 'UNLOCK']
    if (!validActions.includes(action)) return error(`Invalid action. Must be one of: ${validActions.join(', ')}`)

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      include: { role: true },
    })
    if (!targetUser) return error('User not found', 404)

    // Prevent admins from blocking super admins
    if (targetUser.role?.name === 'SUPER_ADMIN' && action === 'BLOCK') {
      return forbidden('Cannot block a Super Admin')
    }

    const statusMap: Record<string, string> = {
      APPROVE: 'ACTIVE',
      REJECT: 'REJECTED',
      BLOCK: 'BLOCKED',
      UNBLOCK: 'ACTIVE',
      DEACTIVATE: 'DEACTIVATED',
    }

    const updateData: Record<string, unknown> = {}
    if (statusMap[action]) updateData.status = statusMap[action]
    if (action === 'UNLOCK') {
      updateData.failedLoginAttempts = 0
      updateData.lockedUntil = null
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
    })

    // Create approval record
    await db.approval.create({
      data: {
        userId,
        action,
        reason: reason || null,
        reviewedBy: result.auth.userId,
        status: action === 'REJECT' ? 'REJECTED' : 'APPROVED',
        reviewedAt: new Date(),
      },
    })

    // Create notification for the user
    const notificationMessages: Record<string, { title: string; message: string }> = {
      APPROVE: { title: 'Account Approved', message: 'Your account has been approved. You can now access all features.' },
      REJECT: { title: 'Account Rejected', message: reason || 'Your account application has been rejected.' },
      BLOCK: { title: 'Account Blocked', message: reason || 'Your account has been blocked by an administrator.' },
      UNBLOCK: { title: 'Account Unblocked', message: 'Your account has been unblocked. You can log in again.' },
    }

    if (notificationMessages[action]) {
      await db.notification.create({
        data: {
          userId,
          type: action === 'APPROVE' ? 'APPROVAL' : action === 'REJECT' ? 'REJECTION' : 'SYSTEM',
          ...notificationMessages[action],
          channel: 'IN_APP',
        },
      })
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: result.auth.userId,
      action: `admin.user_${action.toLowerCase()}`,
      entity: 'User',
      entityId: userId,
      details: { previousStatus: targetUser.status, newStatus: updateData.status, reason },
      ipAddress,
      userAgent,
    })

    return success({ user: updated })
  } catch (err) {
    console.error('[ADMIN USERS PATCH] Error:', err)
    return error('Failed to update user', 500)
  }
}
