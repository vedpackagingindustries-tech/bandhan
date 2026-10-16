import { db } from '@/lib/db'
import { success, error, unauthorized, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { hashPassword, verifyPassword, checkRateLimit } from '@/lib/auth'
import { sendOTP, verifyOTP } from '@/lib/otp'
import { logAudit, logSecurityEvent } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * PUT /api/v1/auth/password — Change password (authenticated)
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

    const rateCheck = checkRateLimit(`password_change:${auth.userId}`)
    if (!rateCheck.allowed) {
      return error('Too many password change attempts. Please try again later.', 429)
    }

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

    const newHash = await hashPassword(newPassword)
    await db.user.update({
      where: { id: auth.userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    })

    const currentToken = request.headers.get('authorization')?.replace('Bearer ', '')
    await db.userSession.deleteMany({
      where: {
        userId: auth.userId,
        token: { not: currentToken || '' },
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

/**
 * POST /api/v1/auth/password — Initiate forgot-password (send OTP)
 * Body: { identifier: email|phone, method?: 'EMAIL'|'SMS'|'WHATSAPP' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, method } = body

    if (!identifier) {
      return error('Email or phone number is required')
    }

    const rateCheck = checkRateLimit(`pw_reset:${identifier}`, 3, 15 * 60 * 1000)
    if (!rateCheck.allowed) {
      return error('Too many password reset attempts. Please try again later.', 429)
    }

    const user = await db.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
      select: { id: true, email: true, phone: true, status: true },
    })

    if (!user) {
      return success({ message: 'If an account exists, a verification code has been sent.', identifier })
    }

    if (user.status === 'BLOCKED' || user.status === 'DEACTIVATED') {
      return error('Account is not active. Please contact support.', 403)
    }

    const validMethods = ['EMAIL', 'SMS', 'WHATSAPP', 'BOTH']
    const deliveryMethod = method || (identifier.includes('@') ? 'EMAIL' : 'SMS')
    if (!validMethods.includes(deliveryMethod)) return error('Invalid delivery method. Use EMAIL, SMS, WHATSAPP, or BOTH.')

    await sendOTP({
      userId: user.id,
      identifier,
      type: 'RESET_PASSWORD',
      method: deliveryMethod,
      ipAddress: getClientInfo(request).ipAddress,
    })

    return success({
      message: 'Verification code sent to your ' + (deliveryMethod === 'EMAIL' ? 'email' : deliveryMethod === 'WHATSAPP' ? 'WhatsApp' : 'phone') + '.',
      identifier,
    })
  } catch (err) {
    console.error('[PASSWORD RESET] Error:', err)
    return error('Password reset initiation failed')
  }
}

/**
 * PATCH /api/v1/auth/password — Complete forgot-password (verify OTP + set new password)
 * Body: { identifier, otpCode, newPassword }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, otpCode, newPassword } = body

    if (!identifier || !otpCode || !newPassword) {
      return error('Identifier, verification code, and new password are required')
    }

    if (newPassword.length < 8) return error('New password must be at least 8 characters')
    if (!/[A-Z]/.test(newPassword)) return error('New password must contain at least one uppercase letter')
    if (!/[0-9]/.test(newPassword)) return error('New password must contain at least one digit')
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) return error('New password must contain at least one special character')

    const rateCheck = checkRateLimit(`pw_reset_verify:${identifier}`, 5, 15 * 60 * 1000)
    if (!rateCheck.allowed) return error('Too many attempts. Please try again later.', 429)

    const otpResult = await verifyOTP({
      identifier,
      otpCode,
      ipAddress: getClientInfo(request).ipAddress,
    })

    if (!otpResult.success) {
      return error(
        otpResult.error === 'INVALID_OTP' ? 'Invalid verification code' :
        otpResult.error === 'OTP_EXPIRED' ? 'Code expired. Request a new one.' :
        otpResult.error === 'MAX_ATTEMPTS_EXCEEDED' ? 'Too many failed attempts. Request a new code.' :
        'Verification failed', 400)
    }

    const user = await db.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
      select: { id: true },
    })

    if (!user) return error('User not found', 404)

    const newHash = await hashPassword(newPassword)
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    })

    await db.userSession.deleteMany({ where: { userId: user.id } })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({ userId: user.id, action: 'user.password_reset', entity: 'User', entityId: user.id, ipAddress, userAgent })
    await logSecurityEvent({ userId: user.id, eventType: 'PASSWORD_RESET', description: 'Password reset completed', ipAddress, userAgent, severity: 'INFO' })

    return success({ message: 'Password reset successfully. Please log in with your new password.' })
  } catch (err) {
    console.error('[PASSWORD RESET VERIFY] Error:', err)
    return error('Password reset verification failed')
  }
}
