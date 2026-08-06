
import { db } from '@/lib/db'
import { unauthorized, success, error, isAdmin, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({
      where: { token },
      include: { user: { include: { role: true } } },
    })

    if (!session || session.expiresAt < new Date()) return unauthorized()
    if (!isAdmin(session.user.role?.name)) return error('Admin access required', 403)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const tier = searchParams.get('tier')

    const where: Record<string, unknown> = {
      role: { name: { not: 'SUPER_ADMIN' } },
    }
    if (status) where.status = status
    if (category) where.registrationCategory = category
    if (tier) where.membershipTier = tier
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { phone: { contains: search } },
        { profile: { firstName: { contains: search } } },
        { profile: { lastName: { contains: search } } },
      ]
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          profile: { select: { firstName: true, lastName: true, displayName: true, city: true, state: true, profilePhotoUrl: true } },
          role: { select: { name: true, displayName: true } },
          memberships: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    return success({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('[ADMIN USERS] Error:', err)
    return error('Failed to fetch users')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({
      where: { token },
      include: { user: { include: { role: true } } },
    })

    if (!session || session.expiresAt < new Date()) return unauthorized()
    if (!isAdmin(session.user.role?.name)) return error('Admin access required', 403)

    const body = await request.json()
    const { userId, action, reason, roleId, membershipTier } = body

    if (!userId || !action) return error('User ID and action are required')

    const { ipAddress, userAgent } = getClientInfo(request)
    const validActions = ['APPROVE', 'REJECT', 'BLOCK', 'UNBLOCK']
    if (!validActions.includes(action)) return error('Invalid action')

    const statusMap: Record<string, string> = {
      APPROVE: 'ACTIVE',
      REJECT: 'REJECTED',
      BLOCK: 'BLOCKED',
      UNBLOCK: 'ACTIVE',
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return error('User not found', 404)

    // Update user status
    await db.user.update({
      where: { id: userId },
      data: {
        status: statusMap[action],
        ...(membershipTier ? { membershipTier } : {}),
        ...(roleId ? { roleId } : {}),
      },
    })

    // Create approval record
    await db.approval.create({
      data: {
        userId,
        action,
        reason: reason || null,
        reviewedBy: session.userId,
        status: action === 'APPROVE' || action === 'UNBLOCK' ? 'APPROVED' : 'REJECTED',
        reviewedAt: new Date(),
      },
    })

    // Notify user
    const { createNotification } = await import('@/lib/notification')
    const messages: Record<string, { title: string; message: string }> = {
      APPROVE: { title: 'Account Approved', message: 'Your account has been approved. You can now access all features.' },
      REJECT: { title: 'Account Rejected', message: `Your registration was rejected. Reason: ${reason || 'Not specified'}` },
      BLOCK: { title: 'Account Blocked', message: 'Your account has been blocked. Contact support for assistance.' },
      UNBLOCK: { title: 'Account Unblocked', message: 'Your account has been unblocked. You can now log in.' },
    }
    const msg = messages[action]
    await createNotification({ userId, type: action === 'APPROVE' ? 'APPROVAL' : 'REJECTION', title: msg.title, message: msg.message })

    await logAudit({
      userId: session.userId,
      action: `admin.${action.toLowerCase()}_user`,
      entity: 'User',
      entityId: userId,
      details: { action, reason, previousStatus: user.status },
      ipAddress,
      userAgent,
    })

    return success({ message: `User ${action.toLowerCase()}d successfully` })
  } catch (err) {
    console.error('[ADMIN USER ACTION] Error:', err)
    return error('Action failed')
  }
}
