// ═══════════════════════════════════════════════════════════
// SMS SERVICE
// Production: replace with Twilio / SMSGateway / MSG91.
// Interface is designed for drop-in replacement.
// ═══════════════════════════════════════════════════════════

export interface SmsPayload {
  to: string
  message: string
  from?: string
}

export interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an SMS message.
 * Currently logs to console. Replace with actual provider.
 */
export async function sendSms(payload: SmsPayload): Promise<SmsResult> {
  try {
    // Integration point: Twilio, MSG91, etc.
    // const twilio = require('twilio')
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    // const result = await client.messages.create({
    //   body: payload.message,
    //   from: payload.from || process.env.TWILIO_PHONE_NUMBER,
    //   to: payload.to,
    // })
    // return { success: true, messageId: result.sid }

    // Mask phone number in logs for security
    const maskedPhone = payload.to.length > 4
      ? `****${payload.to.slice(-4)}`
      : '****'

    console.log(`[SMS] To: ${maskedPhone} | Message length: ${payload.message.length} chars`)

    return {
      success: true,
      messageId: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }
  } catch (err) {
    console.error('[SMS] Send failed:', err)
    return { success: false, error: String(err) }
  }
}

/**
 * Send OTP via SMS.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<SmsResult> {
  return sendSms({
    to: phone,
    message: `Your Bandhan verification code is: ${otp}. Valid for 10 minutes. Do not share with anyone. - Bandhan`,
  })
}