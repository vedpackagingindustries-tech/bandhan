// ═══════════════════════════════════════════════════════════
// SMS / WHATSAPP SERVICE
// Primary: Twilio (SMS + WhatsApp)
// Fallback: MSG91 (India-focused SMS)
// If no keys configured, logs to console for development.
// ═══════════════════════════════════════════════════════════

export interface SmsPayload {
  to: string
  message: string
  from?: string
  isWhatsApp?: boolean
}

export interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
}

/** Mask phone for secure logging */
function maskPhone(phone: string): string {
  return phone.length > 4 ? `****${phone.slice(-4)}` : '****'
}

/**
 * Send SMS via Twilio API, or MSG91, or console fallback.
 * Twilio free trial: $15.50 credit on signup.
 */
export async function sendSms(payload: SmsPayload): Promise<SmsResult> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  const twilioFrom = payload.from || process.env.TWILIO_PHONE_NUMBER || '+1234567890'
  const msg91Key = process.env.MSG91_API_KEY

  // ─── WhatsApp via Twilio ───
  if (payload.isWhatsApp && twilioSid && twilioToken) {
    try {
      const whatsappFrom = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'}`
      const whatsappTo = `whatsapp:${payload.to}`

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: whatsappFrom,
            To: whatsappTo,
            Body: payload.message,
          }).toString(),
        }
      )

      const data = await response.json()
      if (data.error_code) {
        console.error('[WHATSAPP] Twilio error:', data.error_message)
        return { success: false, error: data.error_message }
      }
      return { success: true, messageId: data.sid }
    } catch (err) {
      console.error('[WHATSAPP] Send failed:', err)
      return { success: false, error: String(err) }
    }
  }

  // ─── SMS via Twilio ───
  if (twilioSid && twilioToken) {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: twilioFrom,
            To: payload.to,
            Body: payload.message,
          }).toString(),
        }
      )

      const data = await response.json()
      if (data.error_code) {
        console.error('[SMS] Twilio error:', data.error_message)
        return { success: false, error: data.error_message }
      }
      return { success: true, messageId: data.sid }
    } catch (err) {
      console.error('[SMS] Twilio send failed:', err)
      return { success: false, error: String(err) }
    }
  }

  // ─── SMS via MSG91 (India-focused) ───
  if (msg91Key) {
    try {
      const response = await fetch('https://api.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'authkey': msg91Key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: process.env.MSG91_OTP_TEMPLATE_ID || 'default',
          mobile: payload.to,
          VAR1: payload.message,
        }),
      })

      const data = await response.json()
      if (data.type !== 'success') {
        console.error('[SMS] MSG91 error:', data)
        return { success: false, error: data.message || 'MSG91 error' }
      }
      return { success: true, messageId: data.messageId }
    } catch (err) {
      console.error('[SMS] MSG91 send failed:', err)
      return { success: false, error: String(err) }
    }
  }

  // ─── Fallback: console log (development) ───
  console.log(`[SMS-DEV] To: ${maskPhone(payload.to)} | ${payload.isWhatsApp ? '(WhatsApp) ' : ''}Message: ${payload.message.substring(0, 50)}...`)
  return {
    success: true,
    messageId: `dev_sms_${Date.now()}`,
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

/**
 * Send OTP via WhatsApp.
 */
export async function sendOtpWhatsApp(phone: string, otp: string): Promise<SmsResult> {
  return sendSms({
    to: phone,
    isWhatsApp: true,
    message: `Your Bandhan verification code is: ${otp}. Valid for 10 minutes. Do not share with anyone. - Bandhan`,
  })
}
