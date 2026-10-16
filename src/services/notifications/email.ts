// ═══════════════════════════════════════════════════════════
// EMAIL SERVICE — Resend API (free tier: 100 emails/day)
// Set RESEND_API_KEY env var to activate real delivery.
// Falls back to console log if no API key is configured.
// ═══════════════════════════════════════════════════════════

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'Bandhan <noreply@bandhan.app>'

/**
 * Send an email via Resend API (or console fallback).
 * Resend free tier: 100 emails/day, 3,000/month.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    // Fallback: log to console when no API key configured
    console.log(`[EMAIL-DEV] To: ${payload.to} | Subject: ${payload.subject}`)
    return {
      success: true,
      messageId: `dev_email_${Date.now()}`,
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from || FROM_ADDRESS,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[EMAIL] Resend error:', data)
      return { success: false, error: data.message || 'Resend API error' }
    }

    return {
      success: true,
      messageId: data.id,
    }
  } catch (err) {
    console.error('[EMAIL] Send failed:', err)
    return { success: false, error: String(err) }
  }
}

/**
 * Send a templated email using predefined templates.
 */
export async function sendTemplatedEmail(
  to: string,
  templateId: string,
  data: Record<string, string>
): Promise<EmailResult> {
  const templates: Record<string, { subject: string | ((d: Record<string, string>) => string); body: (d: Record<string, string>) => string }> = {
    WELCOME: {
      subject: 'Welcome to Bandhan - Sahu Samaj Connects',
      body: (d) => `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#b91c1c">Welcome, ${d.name}!</h1><p>Thank you for registering on Bandhan. Your account is pending approval.</p><p>You will be notified once your account is verified.</p><hr><p style="color:#666;font-size:12px">Bandhan — Sahu Samaj Connects</p></body></html>`,
    },
    APPROVAL: {
      subject: 'Your Bandhan Account Has Been Approved',
      body: (d) => `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#16a34a">Account Approved!</h1><p>Hello ${d.name},</p><p>Your Bandhan account has been approved. You can now log in and access all features.</p><hr><p style="color:#666;font-size:12px">Bandhan — Sahu Samaj Connects</p></body></html>`,
    },
    REJECTION: {
      subject: 'Bandhan Registration Update',
      body: (d) => `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1>Registration Update</h1><p>Hello ${d.name},</p><p>Your registration could not be approved. Reason: ${d.reason || 'Not specified'}.</p><p>Please contact support if you believe this is an error.</p><hr><p style="color:#666;font-size:12px">Bandhan — Sahu Samaj Connects</p></body></html>`,
    },
    PASSWORD_CHANGED: {
      subject: 'Your Bandhan Password Has Been Changed',
      body: (d) => `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1>Password Changed</h1><p>Hello ${d.name},</p><p>Your Bandhan account password was successfully changed. If you did not make this change, please contact support immediately.</p><hr><p style="color:#666;font-size:12px">Bandhan — Sahu Samaj Connects</p></body></html>`,
    },
    PASSWORD_RESET: {
      subject: 'Reset Your Bandhan Password',
      body: (d) => `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#b91c1c">Password Reset</h1><p>Hello ${d.name},</p><p>Your password reset verification code is: <strong style="font-size:24px;color:#b91c1c">${d.otp}</strong></p><p>This code expires in 10 minutes. Do not share it with anyone.</p><p>If you did not request a password reset, ignore this email.</p><hr><p style="color:#666;font-size:12px">Bandhan — Sahu Samaj Connects</p></body></html>`,
    },
    MEMBERSHIP_UPGRADE: {
      subject: (d) => `Your Bandhan ${d.tier} Membership is Active`,
      body: (d) => `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#16a34a">${d.tier} Membership Active!</h1><p>Hello ${d.name},</p><p>Your ${d.tier} membership is now active. Enjoy your enhanced features!</p><hr><p style="color:#666;font-size:12px">Bandhan — Sahu Samaj Connects</p></body></html>`,
    },
    CONTACT_REQUEST: {
      subject: 'New Contact Request on Bandhan',
      body: (d) => `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1>New Contact Request</h1><p>Hello ${d.name},</p><p>You have received a new contact request. Log in to view details.</p><hr><p style="color:#666;font-size:12px">Bandhan — Sahu Samaj Connects</p></body></html>`,
    },
    OTP: {
      subject: 'Your Bandhan Verification Code',
      body: (d) => `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1>Verification Code</h1><p>Your verification code is: <strong style="font-size:28px;color:#b91c1c;letter-spacing:4px">${d.otp}</strong></p><p>This code expires in 10 minutes. Do not share it with anyone.</p><hr><p style="color:#666;font-size:12px">Bandhan — Sahu Samaj Connects</p></body></html>`,
    },
  }

  const template = templates[templateId]
  if (!template) {
    return { success: false, error: `Unknown template: ${templateId}` }
  }

  const subject = typeof template.subject === 'function' ? template.subject(data) : template.subject
  return sendEmail({
    to,
    subject,
    html: template.body(data),
  })
}
