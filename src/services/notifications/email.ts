// ═══════════════════════════════════════════════════════════
// EMAIL SERVICE
// Production: replace with SendGrid / AWS SES / Resend.
// Interface is designed for drop-in replacement.
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

/**
 * Send an email.
 * Currently logs to console. Replace with actual provider.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  try {
    console.log(`[EMAIL] To: ${payload.to} | Subject: ${payload.subject}`)
    console.log(`[EMAIL] HTML length: ${payload.html.length} chars`)

    return {
      success: true,
      messageId: `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
  const templates: Record<string, { subject: string; body: (d: Record<string, string>) => string }> = {
    WELCOME: {
      subject: 'Welcome to Bandhan - Sahu Samaj Connects',
      body: (d) => `<h1>Welcome, ${d.name}!</h1><p>Thank you for registering on Bandhan. Your account is pending approval.</p><p>You will be notified once your account is verified.</p>`,
    },
    APPROVAL: {
      subject: 'Your Bandhan Account Has Been Approved',
      body: (d) => `<h1>Account Approved!</h1><p>Hello ${d.name},</p><p>Your Bandhan account has been approved. You can now log in and access all features.</p>`,
    },
    REJECTION: {
      subject: 'Bandhan Registration Update',
      body: (d) => `<h1>Registration Update</h1><p>Hello ${d.name},</p><p>Your registration could not be approved. Reason: ${d.reason || 'Not specified'}.</p><p>Please contact support if you believe this is an error.</p>`,
    },
    PASSWORD_CHANGED: {
      subject: 'Your Bandhan Password Has Been Changed',
      body: (d) => `<h1>Password Changed</h1><p>Hello ${d.name},</p><p>Your Bandhan account password was successfully changed. If you did not make this change, please contact support immediately.</p>`,
    },
    MEMBERSHIP_UPGRADE: {
      subject: `Your Bandhan ${d.tier} Membership is Active`,
      body: (d) => `<h1>${d.tier} Membership Active!</h1><p>Hello ${d.name},</p><p>Your ${d.tier} membership is now active. Enjoy your enhanced features!</p>`,
    },
    CONTACT_REQUEST: {
      subject: 'New Contact Request on Bandhan',
      body: (d) => `<h1>New Contact Request</h1><p>Hello ${d.name},</p><p>You have received a new contact request. Log in to view details.</p>`,
    },
    OTP: {
      subject: 'Your Bandhan Verification Code',
      body: (d) => `<h1>Verification Code</h1><p>Your verification code is: <strong>${d.otp}</strong></p><p>This code expires in 10 minutes. Do not share it with anyone.</p>`,
    },
  }

  const template = templates[templateId]
  if (!template) {
    return { success: false, error: `Unknown template: ${templateId}` }
  }

  return sendEmail({
    to,
    subject: template.subject,
    html: template.body(data),
  })
}
