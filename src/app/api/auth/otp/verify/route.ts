'use server'

import { db } from '@/lib/db'
import { verifyOTP } from '@/lib/otp'
import { logAudit } from '@/lib/audit'
import { success, error, getClientInfo } from '@/lib/api-response'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, otpCode, userId } = body

    if (!identifier || !otpCode) return error('Identifier and OTP code are required')

    const { ipAddress, userAgent } = getClientInfo(request)

    const result = await verifyOTP({ identifier, otpCode, userId, ipAddress })

    if (!result.success) {
      return error(result.error!)
    }

    // Update user verification status
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId } })
      if (user) {
        const updateData: Record<string, unknown> = {}
        if (identifier.includes('@')) {
          updateData.emailVerified = true
        } else {
          updateData.phoneVerified = true
        }
        await db.user.update({ where: { id: userId }, data: updateData })
      }

      await logAudit({
        userId,
        action: 'user.otp_verified',
        entity: 'OtpVerification',
        details: { identifier, type: 'verify' },
        ipAddress,
        userAgent,
      })
    }

    return success({ verified: true, message: 'OTP verified successfully' })
  } catch (err) {
    console.error('[OTP VERIFY] Error:', err)
    return error('OTP verification failed')
  }
}
