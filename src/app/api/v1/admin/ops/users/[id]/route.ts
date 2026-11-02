import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { logAudit, logSecurityEvent } from '@/lib/audit'
import { invalidateRoleCache } from '@/lib/rbac'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

// ── SAFE PROFILE FIELDS ──
const SAFE_PROFILE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  gender: true,
  dateOfBirth: true,
  address: true,
  city: true,
  state: true,
  country: true,
  pincode: true,
  profilePhotoUrl: true,
  coverPhotoUrl: true,
  occupation: true,
  education: true,
  annualIncome: true,
  companyName: true,
  designation: true,
  maritalStatus: true,
  gotraId: true,
  bio: true,
  profileVisible: true,
  phoneVisible: true,
  emailVisible: true,
  contactPermission: true,
  familyType: true,
  aboutFamily: true,
  fatherName: true,
  motherName: true,
  familyCity: true,
  createdAt: true,
  updatedAt: true,
} as const

// ═══════════════════════════════════════════════════════════
// GET — Single user full details
// ═══════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
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
        deviceId: true,
        ipAddress: true,
        userAgent: true,
        acceptedTerms: true,
        deletedAt: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: { id: true, name: true, displayName: true, level: true, description: true },
        },
        profile: { select: SAFE_PROFILE_SELECT },
        memberships: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            tier: true,
            status: true,
            startedAt: true,
            expiresAt: true,
            paymentMethod: true,
            paymentRef: true,
            amount: true,
            createdAt: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            action: true,
            entity: true,
            entityId: true,
            details: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
          },
        },
        securityEvents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            eventType: true,
            description: true,
            ipAddress: true,
            userAgent: true,
            severity: true,
            createdAt: true,
          },
        },
        loginHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            device: true,
            location: true,
            success: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            reports: true,
            payments: true,
            contactRequestsSent: true,
            contactRequestsReceived: true,
            businesses: true,
            directories: true,
            jobs: true,
            jobApplications: true,
            media: true,
          },
        },
      },
    })

    if (!user) return error('User not found', 404)

    return success({ user })
  } catch (err) {
    console.error('[OPS USER DETAIL] Error:', err)
    return serverError()
  }
}

// ═══════════════════════════════════════════════════════════
// PUT — Update a single user
// ═══════════════════════════════════════════════════════════

interface UserUpdateBody {
  status?: string
  roleId?: string
  membershipTier?: string
  emailVerified?: boolean
  phoneVerified?: boolean
  mustChangePassword?: boolean
}

const VALID_STATUSES = ['ACTIVE', 'PENDING_APPROVAL', 'BLOCKED', 'REJECTED', 'DEACTIVATED']
const VALID_TIERS = ['FREE', 'PREMIUM', 'ELITE']

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const { ipAddress, userAgent } = getClientInfo(request)

    const { id } = await params

    // Verify user exists
    const existing = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        roleId: true,
        membershipTier: true,
        emailVerified: true,
        phoneVerified: true,
        mustChangePassword: true,
        role: { select: { name: true } },
      },
    })
    if (!existing) return error('User not found', 404)

    const body: UserUpdateBody = await request.json()
    const updateData: Prisma.UserUpdateArgs['data'] = {}
    const changes: Record<string, { from: unknown; to: unknown }> = {}

    // Validate and apply status
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return error(`Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`)
      }
      if (body.status !== existing.status) {
        changes.status = { from: existing.status, to: body.status }
        updateData.status = body.status
      }
    }

    // Validate and apply role
    if (body.roleId !== undefined) {
      const targetRole = await db.role.findUnique({
        where: { id: body.roleId },
        select: { id: true, name: true },
      })
      if (!targetRole) return error('Target role not found', 404)
      if (body.roleId !== existing.roleId) {
        changes.roleId = { from: existing.roleId, to: body.roleId }
        updateData.roleId = body.roleId
      }
    }

    // Validate and apply membership tier
    if (body.membershipTier !== undefined) {
      if (!VALID_TIERS.includes(body.membershipTier)) {
        return error(`Invalid membershipTier. Allowed: ${VALID_TIERS.join(', ')}`)
      }
      if (body.membershipTier !== existing.membershipTier) {
        changes.membershipTier = { from: existing.membershipTier, to: body.membershipTier }
        updateData.membershipTier = body.membershipTier
      }
    }

    // Apply verification flags
    if (body.emailVerified !== undefined && body.emailVerified !== existing.emailVerified) {
      changes.emailVerified = { from: existing.emailVerified, to: body.emailVerified }
      updateData.emailVerified = body.emailVerified
    }

    if (body.phoneVerified !== undefined && body.phoneVerified !== existing.phoneVerified) {
      changes.phoneVerified = { from: existing.phoneVerified, to: body.phoneVerified }
      updateData.phoneVerified = body.phoneVerified
    }

    if (body.mustChangePassword !== undefined && body.mustChangePassword !== existing.mustChangePassword) {
      changes.mustChangePassword = { from: existing.mustChangePassword, to: body.mustChangePassword }
      updateData.mustChangePassword = body.mustChangePassword
    }

    // Nothing to update
    if (Object.keys(updateData).length === 0) {
      return error('No changes to apply', 400)
    }

    // If blocking, log security event
    if (body.status === 'BLOCKED' && existing.status !== 'BLOCKED') {
      await logSecurityEvent({
        userId: id,
        eventType: 'ACCOUNT_BLOCKED',
        description: 'Account blocked by super admin via user management',
        ipAddress,
        userAgent,
        severity: 'WARNING',
        metadata: { blockedBy: auth.userId, previousStatus: existing.status },
      })
    }

    // If unblocking, clear lock fields
    if (body.status === 'ACTIVE' && existing.status === 'BLOCKED') {
      updateData.lockedUntil = null
      updateData.failedLoginAttempts = 0
    }

    // Perform the update
    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        status: true,
        roleId: true,
        membershipTier: true,
        registrationCategory: true,
        lastLoginAt: true,
        loginCount: true,
        emailVerified: true,
        phoneVerified: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: { id: true, name: true, displayName: true, level: true },
        },
      },
    })

    // Invalidate RBAC cache if role changed
    if (body.roleId && body.roleId !== existing.roleId) {
      if (existing.role?.name) await invalidateRoleCache(existing.role.name)
      const newRole = await db.role.findUnique({ where: { id: body.roleId } })
      if (newRole) await invalidateRoleCache(newRole.name)
    }

    // Log audit
    await logAudit({
      userId: auth.userId,
      action: 'admin.update_user',
      entity: 'User',
      entityId: id,
      details: { changes },
      ipAddress,
      userAgent,
    })

    return success({ user: updatedUser })
  } catch (err) {
    console.error('[OPS USER UPDATE] Error:', err)
    return serverError()
  }
}
