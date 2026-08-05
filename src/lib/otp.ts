import { db } from '@/lib/db'
import { generateOTP } from '@/lib/auth'
import { logSecurityEvent } from '@/lib/audit'

const OTP_EXPIRY_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5

export async function sendOTP(params: {
  userId?: string
  identifier: string // phone or email
  type: string // REGISTRATION, LOGIN, RESET_PASSWORD, CHANGE_PHONE, CHANGE_EMAIL
  method: string // SMS, EMAIL, BOTH
  ipAddress?: string
}) {
  const otpCode = generateOTP()
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  // Invalidate previous OTPs for this identifier
  await db.otpVerification.updateMany({
    where: { identifier: params.identifier, verified: false },
    data: { verified: true }, // Mark old ones as "consumed"
  })

  const otp = await db.otpVerification.create({
    data: {
      userId: params.userId,
      type: params.type,
      method: params.method,
      identifier: params.identifier,
      otpCode,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
    },
  })

  // TODO: Replace with actual SMS/Email service integration
  // SMS integration point: Twilio / SMSGateway
  // Email integration point: SendGrid / AWS SES
  console.log(`[OTP] ${params.method} to ${params.identifier}: ${otpCode}`)

  return { otpId: otp.id, expiresAt, identifier: params.identifier }
}

export async function verifyOTP(params: {
  identifier: string
  otpCode: string
  userId?: string
  ipAddress?: string
}): Promise<{ success: boolean; error?: string }> {
  const otp = await db.otpVerification.findFirst({
    where: {
      identifier: params.identifier,
      verified: false,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!otp) {
    return { success: false, error: 'NO_OTP_FOUND' }
  }

  if (otp.expiresAt < new Date()) {
    return { success: false, error: 'OTP_EXPIRED' }
  }

  if (otp.attempts >= otp.maxAttempts) {
    await logSecurityEvent({
      userId: params.userId,
      eventType: 'OTP_FAILED',
      description: `Max OTP attempts exceeded for ${params.identifier}`,
      ipAddress: params.ipAddress,
      severity: 'WARNING',
    })
    return { success: false, error: 'MAX_ATTEMPTS_EXCEEDED' }
  }

  // Increment attempt
  await db.otpVerification.update({
    where: { id: otp.id },
    data: { attempts: { increment: 1 } },
  })

  if (otp.otpCode !== params.otpCode) {
    return { success: false, error: 'INVALID_OTP' }
  }

  // Mark as verified
  await db.otpVerification.update({
    where: { id: otp.id },
    data: { verified: true, verifiedAt: new Date() },
  })

  return { success: true }
}
