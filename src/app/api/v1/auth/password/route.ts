import { db } from '@/lib/db'
import { success, error, unauthorized, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { hashPassword, verifyPassword, checkRateLimit } from '@/lib/auth'
import { logAudit, logSecurityEvent } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * PUT /api/v1/auth/password — Change password
 */
export async function PUT(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return error('Current password and new password are required')
    }

    if (newPassword.length < 8) {
      return error('New password must be at least 8 characters')
    }

    if (!/[A-Z]/.test(newPassword)) {
      return error('New password must contain at least one uppercase letter')
    }

    if (!/[0-9]/.test(newPassword)) {
      return error('New password must contain at least one digit')
    }

    // Rate limiting
    const rateCheck = checkRateLimit(`password_change:${auth.userId}`)
    if (!rateCheck.allowed) {
      return error('Too many password change attempts. Please try again later.', 429)
    }

    // Verify current password
    const user = await db.user.findUnique({ where: { id: auth.userId } })
    if (!user?.passwordHash) {
      return error('No password set for this account')
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      await logSecurityEvent({
        userId: auth.userId,
        eventType: 'PASSWORD_FAILED',
        description: 'Incorrect current password during change attempt',
        ...getClientInfo(request),
        severity: 'WARNING',
      })
      return unauthorized('Current password is incorrect')
    }

    const { ipAddress, userAgent } = getClientInfo(request)

    // Hash and update
    const newHash = await hashPassword(newPassword)
    await db.user.update({
      where: { id: auth.userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    })

    await logAudit({
      userId: auth.userId,
      action: 'user.password_change',
      entity: 'User',
      entityId: auth.userId,
      ipAddress,
      userAgent,
    })

    await logSecurityEvent({
      userId: auth.userId,
      eventType: 'PASSWORD_CHANGED',
      description: 'Password changed successfully',
      ipAddress,
      userAgent,
      severity: 'INFO',
    })

    return success({ message: 'Password changed successfully' })
  } catch (err) {
    console.error('[PASSWORD CHANGE] Error:', err)
    return error('Password change failed')
  }
}
