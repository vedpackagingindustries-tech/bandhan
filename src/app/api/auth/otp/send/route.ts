'use server'

import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/auth'
import { sendOTP } from '@/lib/otp'
import { success, error, getClientInfo } from '@/lib/api-response'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, type, method, userId } = body

    if (!identifier) return error('Identifier (email/phone) is required')

    const validTypes = ['REGISTRATION', 'LOGIN', 'RESET_PASSWORD', 'CHANGE_PHONE', 'CHANGE_EMAIL']
    if (type && !validTypes.includes(type)) return error('Invalid OTP type')

    const validMethods = ['SMS', 'EMAIL', 'BOTH']
    const otpMethod = method || (identifier.includes('@') ? 'EMAIL' : 'SMS')
    if (!validMethods.includes(otpMethod)) return error('Invalid method')

    // Rate limiting
    const rateCheck = checkRateLimit(`otp:${identifier}`)
    if (!rateCheck.allowed) return error('Too many OTP requests. Please wait.', 429)

    const { ipAddress } = getClientInfo(request)

    const result = await sendOTP({
      userId,
      identifier,
      type: type || 'LOGIN',
      method: otpMethod,
      ipAddress,
    })

    return success({
      otpId: result.otpId,
      expiresAt: result.expiresAt,
      identifier: result.identifier,
      message: `OTP sent to ${result.identifier}`,
    })
  } catch (err) {
    console.error('[OTP SEND] Error:', err)
    return error('Failed to send OTP')
  }
}
