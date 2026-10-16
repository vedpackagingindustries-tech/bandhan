import { db } from '@/lib/db'
import { generateOTP, hashOTP, verifyOTPCode } from '@/lib/auth'
import { logSecurityEvent } from '@/lib/audit'
import { enqueueJob } from '@/services/queue'

const OTP_EXPIRY_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5

export async function sendOTP(params: {
  userId?: string
  identifier: string // phone or email
  type: string // REGISTRATION, LOGIN, RESET_PASSWORD, CHANGE_PHONE, CHANGE_EMAIL
  method: string // SMS, EMAIL, BOTH, WHATSAPP
  ipAddress?: string
}) {
  const otpCode = generateOTP()
  const otpHash = hashOTP(otpCode) // Store hash for secure verification
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  // Invalidate previous OTPs for this identifier
  await db.otpVerification.updateMany({
    where: { identifier: params.identifier, verified: false },
    data: { verified: true }, // Mark old ones as "consumed"
  })

  // Determine if email delivery is configured
  const emailConfigured = !!(process.env.RESEND_API_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL)

  // Store plaintext OTP ONLY when email delivery is not configured
  // This allows admin to view and share OTP via phone/WhatsApp
  const otpPlain = emailConfigured ? null : otpCode

  const otp = await db.otpVerification.create({
    data: {
      userId: params.userId,
      type: params.type,
      method: params.method,
      identifier: params.identifier,
      otpCode: otpHash, // HMAC hash for verification
      otpPlain, // Plaintext for admin viewing (null when email works)
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
    },
  })

  // Dispatch OTP via queue — real delivery
  if (params.method === 'EMAIL' || params.method === 'BOTH') {
    enqueueJob('EMAIL_SEND', {
      templateId: 'OTP',
      to: params.identifier,
      data: { otp: otpCode, name: 'User' },
    })
  }

  if (params.method === 'SMS' || params.method === 'BOTH') {
    enqueueJob('SMS_SEND', {
      to: params.identifier,
      message: `Your Bandhan verification code is: ${otpCode}. Valid for 10 minutes. - Bandhan`,
    })
  }

  if (params.method === 'WHATSAPP') {
    enqueueJob('SMS_SEND', {
      to: params.identifier,
      message: `Your Bandhan verification code is: ${otpCode}. Valid for 10 minutes. - Bandhan`,
      isWhatsApp: true,
    })
  }

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

  // Increment attempt BEFORE checking — prevents timing oracle
  await db.otpVerification.update({
    where: { id: otp.id },
    data: { attempts: { increment: 1 } },
  })

  // Timing-safe OTP comparison using HMAC hash
  if (!verifyOTPCode(params.otpCode, otp.otpCode)) {
    return { success: false, error: 'INVALID_OTP' }
  }

  // Mark as verified and clear plaintext
  await db.otpVerification.update({
    where: { id: otp.id },
    data: { verified: true, verifiedAt: new Date(), otpPlain: null },
  })

  return { success: true }
}
