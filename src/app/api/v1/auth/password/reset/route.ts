import { success, error, getClientInfo } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/auth'
import { sendOTP } from '@/lib/otp'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

/**
 * POST /api/v1/auth/password/reset — Initiate forgot-password flow
 * Sends OTP to email or phone for verification before password reset.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, method } = body // identifier = email or phone, method = EMAIL|SMS|WHATSAPP

    if (!identifier) {
      return error('Email or phone number is required')
    }

    // Rate limit: 3 reset requests per 15 minutes per identifier
    const rateCheck = checkRateLimit(`pw_reset:${identifier}`, 3, 15 * 60 * 1000)
    if (!rateCheck.allowed) {
      return error('Too many password reset attempts. Please try again later.', 429)
    }

    // Find user by email or phone
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
        ],
      },
      select: { id: true, email: true, phone: true, status: true, profile: { select: { firstName: true } } },
    })

    if (!user) {
      // Don't reveal whether user exists — return success anyway to prevent enumeration
      return success({ message: 'If an account with this identifier exists, a verification code has been sent.', identifier })
    }

    if (user.status === 'BLOCKED' || user.status === 'DEACTIVATED') {
      return error('Account is not active. Please contact support.', 403)
    }

    // Determine delivery method
    const deliveryMethod = method || (identifier.includes('@') ? 'EMAIL' : 'SMS')

    // Validate: can only send OTP to verified contact
    if (deliveryMethod === 'EMAIL' && !user.email) {
      return error('No email address associated with this account')
    }
    if ((deliveryMethod === 'SMS' || deliveryMethod === 'WHATSAPP') && !user.phone) {
      return error('No phone number associated with this account')
    }

    // Send OTP
    const otpResult = await sendOTP({
      userId: user.id,
      identifier,
      type: 'RESET_PASSWORD',
      method: deliveryMethod,
      ipAddress: getClientInfo(request).ipAddress,
    })

    return success({
      message: 'Verification code sent. Check your ' + (deliveryMethod === 'EMAIL' ? 'email' : deliveryMethod === 'WHATSAPP' ? 'WhatsApp' : 'phone') + '.',
      otpId: otpResult.otpId,
      expiresAt: otpResult.expiresAt,
      identifier,
    })
  } catch (err) {
    console.error('[PASSWORD RESET] Error:', err)
    return error('Password reset initiation failed')
  }
}
