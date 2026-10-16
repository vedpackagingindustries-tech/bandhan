import { success, error, getClientInfo } from '@/lib/api-response'
import { checkRateLimit, hashPassword } from '@/lib/auth'
import { verifyOTP } from '@/lib/otp'
import { db } from '@/lib/db'
import { logAudit, logSecurityEvent } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * POST /api/v1/auth/password/reset/verify — Complete forgot-password flow
 * Verifies the OTP and sets the new password.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, otpCode, newPassword } = body

    if (!identifier || !otpCode || !newPassword) {
      return error('Identifier, verification code, and new password are required')
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return error('New password must be at least 8 characters')
    }
    if (!/[A-Z]/.test(newPassword)) {
      return error('New password must contain at least one uppercase letter')
    }
    if (!/[0-9]/.test(newPassword)) {
      return error('New password must contain at least one digit')
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      return error('New password must contain at least one special character')
    }

    // Rate limit
    const rateCheck = checkRateLimit(`pw_reset_verify:${identifier}`, 5, 15 * 60 * 1000)
    if (!rateCheck.allowed) {
      return error('Too many attempts. Please try again later.', 429)
    }

    // Verify OTP
    const otpResult = await verifyOTP({
      identifier,
      otpCode,
      ipAddress: getClientInfo(request).ipAddress,
    })

    if (!otpResult.success) {
      return error(otpResult.error === 'INVALID_OTP' ? 'Invalid verification code' :
                   otpResult.error === 'OTP_EXPIRED' ? 'Verification code has expired. Please request a new one.' :
                   otpResult.error === 'MAX_ATTEMPTS_EXCEEDED' ? 'Too many failed attempts. Please request a new code.' :
                   'Verification failed', 400)
    }

    // Find and update user
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
        ],
      },
      select: { id: true },
    })

    if (!user) {
      return error('User not found', 404)
    }

    // Hash and set new password
    const newHash = await hashPassword(newPassword)
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    })

    // Invalidate ALL other sessions for security
    await db.userSession.deleteMany({
      where: { userId: user.id },
    })

    const { ipAddress, userAgent } = getClientInfo(request)

    await logAudit({
      userId: user.id,
      action: 'user.password_reset',
      entity: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    })

    await logSecurityEvent({
      userId: user.id,
      eventType: 'PASSWORD_RESET',
      description: 'Password reset completed successfully via forgot-password flow',
      ipAddress,
      userAgent,
      severity: 'INFO',
    })

    return success({ message: 'Password has been reset successfully. Please log in with your new password.' })
  } catch (err) {
    console.error('[PASSWORD RESET VERIFY] Error:', err)
    return error('Password reset verification failed')
  }
}
