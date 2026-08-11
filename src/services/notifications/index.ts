// ═══════════════════════════════════════════════════════════
// NOTIFICATION DISPATCHER
// Central routing for all notification channels.
// Routes through the queue for async delivery.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { createNotification as createInApp } from '@/lib/notification'
import { sendEmail, sendTemplatedEmail } from './email'
import { sendSms } from './sms'
import { sendPushNotification } from './push'
import { enqueueJob } from '@/services/queue'

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH' | 'BOTH'

interface DispatchParams {
  userId: string
  type: string
  title: string
  message: string
  channel?: NotificationChannel
  data?: Record<string, unknown>
  emailTemplateId?: string
  emailTemplateData?: Record<string, string>
}

/**
 * Dispatch a notification through the appropriate channel(s).
 */
export async function dispatchNotification(params: DispatchParams): Promise<void> {
  const channel = params.channel || 'IN_APP'

  if (channel === 'IN_APP' || channel === 'BOTH') {
    await createInApp({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      channel: 'IN_APP',
      data: params.data,
    })
  }

  if (channel === 'EMAIL' || channel === 'BOTH') {
    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: { email: true, profile: { select: { firstName: true } } },
    })
    if (user?.email) {
      if (params.emailTemplateId && user.profile) {
        enqueueJob('EMAIL_SEND', {
          templateId: params.emailTemplateId,
          to: user.email,
          data: { name: user.profile.firstName || 'User', ...params.emailTemplateData },
        })
      } else {
        enqueueJob('EMAIL_SEND', {
          to: user.email,
          subject: params.title,
          html: `<h2>${params.title}</h2><p>${params.message}</p>`,
        })
      }
    }
  }

  if (channel === 'SMS' || channel === 'BOTH') {
    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: { phone: true },
    })
    if (user?.phone) {
      enqueueJob('SMS_SEND', {
        to: user.phone,
        message: `[Bandhan] ${params.title}: ${params.message}`,
      })
    }
  }

  if (channel === 'PUSH') {
    enqueueJob('NOTIFICATION_PUSH', {
      userId: params.userId,
      title: params.title,
      body: params.message,
      data: params.data as Record<string, string>,
    })
  }
}

export { sendEmail, sendTemplatedEmail } from './email'
export { sendSms } from './sms'
export { sendPushNotification } from './push'
