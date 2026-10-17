import { db } from '@/lib/db'
import { success, error, unauthorized } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/admin/otp/recent — View recent OTPs (admin only)
 * Allows admin to see OTP codes to share with users via phone/WhatsApp.
 * This is the FREE fallback when email delivery is not configured.
 * 
 * When email is configured (Resend/Supabase), otpPlain is null.
 * When email is NOT configured, otpPlain contains the actual OTP code
 * so admin can share it manually via phone/WhatsApp.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    // Only SUPER_ADMIN and ADMIN can view OTPs
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      include: { role: true },
    })

    if (!user?.role || !['SUPER_ADMIN', 'ADMIN'].includes(user.role.name)) {
      return unauthorized('Admin access required')
    }

    // Get recent OTPs (last 30 minutes)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)

    const otps = await db.otpVerification.findMany({
      where: {
        createdAt: { gte: thirtyMinAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        identifier: true,
        type: true,
        method: true,
        verified: true,
        attempts: true,
        maxAttempts: true,
        expiresAt: true,
        createdAt: true,
        otpPlain: true, // Plaintext OTP for admin viewing
      },
    })

    // Get email delivery status
    const emailProvider = process.env.RESEND_API_KEY
      ? 'resend'
      : process.env.NEXT_PUBLIC_SUPABASE_URL
        ? 'supabase_auth'
        : 'console_fallback'

    return success({
      otps,
      emailProvider,
      total: otps.length,
      pending: otps.filter(o => !o.verified && o.expiresAt > new Date()).length,
      message: emailProvider === 'console_fallback'
        ? '⚠️ Email NOT configured. OTPs shown below — share via phone/WhatsApp. Set RESEND_API_KEY for automatic email delivery.'
        : `✅ Email delivery via ${emailProvider}. OTPs are sent automatically.`,
    })
  } catch (err) {
    console.error('[ADMIN-OTP] Error:', err)
    return error('Failed to fetch OTPs')
  }
}
