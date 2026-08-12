import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit, logSecurityEvent } from '@/lib/audit'
import { invalidateRoleCache } from '@/lib/rbac'
import { sanitizeString } from '@/lib/validation'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

// ── SAFE PROFILE FIELDS (no passwordHash, no sessions) ──
const SAFE_PROFILE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  gender: true,
  dateOfBirth: true,
  city: true,
  state: true,
  country: true,
  pincode: true,
  profilePhotoUrl: true,
  coverPhotoUrl: true,
  occupation: true,
  education: true,
  maritalStatus: true,
  gotraId: true,
  profileVisible: true,
  createdAt: true,
  updatedAt: true,
} as const

const BULK_ACTIONS = [
  'APPROVE',
  'REJECT',
  'BLOCK',
  'UNBLOCK',
  'SUSPEND',
  'VERIFY',
  'CHANGE_ROLE',
] as const

type BulkAction = (typeof BULK_ACTIONS)[number]

// ═══════════════════════════════════════════════════════════
// GET — List & search users with advanced filters
// ═══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const { searchParams } = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(searchParams)

    const search = sanitizeString(searchParams.get('search') || '')
    const status = sanitizeString(searchParams.get('status') || '')
    const role = sanitizeString(searchParams.get('role') || '')
    const membershipTier = sanitizeString(searchParams.get('membershipTier') || '')
    const registrationCategory = sanitizeString(searchParams.get('registrationCategory') || '')
    const sortBy = sanitizeString(searchParams.get('sortBy') || 'createdAt')
    const sortOrder = sanitizeString(searchParams.get('sortOrder') || 'desc')

    // Build where clause
    const where: Prisma.UserWhereInput = { deletedAt: null }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
        { profile: { displayName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (status) where.status = status
    if (membershipTier) where.membershipTier = membershipTier
    if (registrationCategory) where.registrationCategory = registrationCategory
    if (role) {
      where.role = { name: role }
    }

    // Validate sort fields
    const validSortFields = ['createdAt', 'lastLoginAt', 'loginCount'] as const
    const validSortOrders = ['asc', 'desc'] as const
    const sortField = validSortFields.includes(sortBy as (typeof validSortFields)[number])
      ? sortBy
      : 'createdAt'
    const sortDir = validSortOrders.includes(sortOrder as (typeof validSortOrders)[number])
      ? sortOrder
      : 'desc'

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortField]: sortDir,
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          authProvider: true,
          status: true,
          roleId: true,
          membershipTier: true,
          registrationCategory: true,
          lastLoginAt: true,
          loginCount: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          mustChangePassword: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          updatedAt: true,
          role: {
            select: { id: true, name: true, displayName: true, level: true },
          },
          profile: { select: SAFE_PROFILE_SELECT },
          memberships: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              tier: true,
              status: true,
              startedAt: true,
              expiresAt: true,
              paymentMethod: true,
              amount: true,
            },
          },
          _count: {
            select: {
              reports: true,
              payments: true,
              loginHistory: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    return success({
      users,
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[OPS USERS LIST] Error:', err)
    return serverError()
  }
}

// ═══════════════════════════════════════════════════════════
// POST — Bulk action on users
// ═══════════════════════════════════════════════════════════

interface BulkActionBody {
  action: string
  userIds: string[]
  reason?: string
  roleId?: string
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const { ipAddress, userAgent } = getClientInfo(request)

    const body: BulkActionBody = await request.json()
    const { action, userIds, reason, roleId } = body

    // Validate action
    if (!action || !BULK_ACTIONS.includes(action as BulkAction)) {
      return error(`Invalid action. Allowed: ${BULK_ACTIONS.join(', ')}`)
    }

    // Validate userIds
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 50) {
      return error('userIds must be a non-empty array with max 50 items')
    }

    // For CHANGE_ROLE, roleId is required
    if (action === 'CHANGE_ROLE' && !roleId) {
      return error('roleId is required for CHANGE_ROLE action')
    }

    // For CHANGE_ROLE, validate the role exists
    if (action === 'CHANGE_ROLE' && roleId) {
      const targetRole = await db.role.findUnique({ where: { id: roleId } })
      if (!targetRole) return error('Target role not found', 404)
    }

    // Fetch all target users
    const users = await db.user.findMany({
      where: { id: { in: userIds }, deletedAt: null },
      select: { id: true, status: true, roleId: true, email: true, role: { select: { name: true } } },
    })

    const foundIds = new Set(users.map((u) => u.id))
    const results: Array<{ userId: string; success: boolean; error?: string }> = []
    let processed = 0

    for (const user of users) {
      try {
        const actionData: Prisma.UserUpdateArgs['data'] = {}
        const typedAction = action as BulkAction

        switch (typedAction) {
          case 'APPROVE':
            actionData.status = 'ACTIVE'
            await db.approval.create({
              data: {
                userId: user.id,
                action: 'APPROVE',
                reason: reason || null,
                reviewedBy: auth.userId,
                status: 'APPROVED',
                reviewedAt: new Date(),
              },
            })
            break

          case 'REJECT':
            actionData.status = 'REJECTED'
            await db.approval.create({
              data: {
                userId: user.id,
                action: 'REJECT',
                reason: reason || null,
                reviewedBy: auth.userId,
                status: 'REJECTED',
                reviewedAt: new Date(),
              },
            })
            break

          case 'BLOCK':
            actionData.status = 'BLOCKED'
            await logSecurityEvent({
              userId: user.id,
              eventType: 'ACCOUNT_BLOCKED',
              description: `Account blocked by super admin. Reason: ${reason || 'Not specified'}`,
              ipAddress,
              userAgent,
              severity: 'WARNING',
              metadata: { blockedBy: auth.userId, reason },
            })
            break

          case 'UNBLOCK':
            actionData.status = 'ACTIVE'
            actionData.lockedUntil = null
            actionData.failedLoginAttempts = 0
            break

          case 'SUSPEND':
            actionData.status = 'DEACTIVATED'
            break

          case 'VERIFY':
            actionData.emailVerified = true
            actionData.phoneVerified = true
            break

          case 'CHANGE_ROLE':
            if (roleId) {
              actionData.roleId = roleId
            }
            break
        }

        // Perform the update
        await db.user.update({
          where: { id: user.id },
          data: actionData,
        })

        // Invalidate RBAC cache if role changed
        if (typedAction === 'CHANGE_ROLE' && roleId && user.role?.name) {
          await invalidateRoleCache(user.role.name)
          const newRole = await db.role.findUnique({ where: { id: roleId } })
          if (newRole) await invalidateRoleCache(newRole.name)
        }

        // Log audit
        await logAudit({
          userId: auth.userId,
          action: `admin.bulk_${typedAction.toLowerCase()}`,
          entity: 'User',
          entityId: user.id,
          details: {
            action: typedAction,
            reason: reason || undefined,
            previousStatus: user.status,
            previousRoleId: user.roleId,
            newRoleId: roleId || undefined,
          },
          ipAddress,
          userAgent,
        })

        processed++
        results.push({ userId: user.id, success: true })
      } catch (userErr) {
        console.error(`[OPS BULK] Failed for user ${user.id}:`, userErr)
        results.push({ userId: user.id, success: false, error: 'Action failed for this user' })
      }
    }

    // Report not-found IDs
    for (const uid of userIds) {
      if (!foundIds.has(uid)) {
        results.push({ userId: uid, success: false, error: 'User not found' })
      }
    }

    return success({ processed, results })
  } catch (err) {
    console.error('[OPS USERS BULK] Error:', err)
    return serverError()
  }
}
