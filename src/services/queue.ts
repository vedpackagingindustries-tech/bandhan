// ═══════════════════════════════════════════════════════════
// BACKGROUND JOB QUEUE
// In-memory queue with retry logic.
// Production: replace with BullMQ / Redis queue.
// ═══════════════════════════════════════════════════════════

export type JobType =
  | 'OTP_SEND'
  | 'EMAIL_SEND'
  | 'SMS_SEND'
  | 'NOTIFICATION_PUSH'
  | 'IMAGE_PROCESS'
  | 'AI_MODERATION'
  | 'AI_APPROVAL_CHECK'
  | 'AI_RISK_ANALYSIS'
  | 'AI_PHOTO_QUALITY'
  | 'AI_SMART_SEARCH'
  | 'AI_AUTOMATION'
  | 'ADVERTISEMENT_SCHEDULE'
  | 'AUDIT_LOG'
  | 'SESSION_CLEANUP'

interface Job {
  id: string
  type: JobType
  payload: Record<string, unknown>
  attempts: number
  maxAttempts: number
  priority: number
  createdAt: number
  runAt: number
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
}

const queue: Job[] = []
let processing = false

// Job handlers registry
const handlers = new Map<JobType, (payload: Record<string, unknown>) => Promise<void>>()

/**
 * Register a job handler for a specific job type.
 */
export function registerJobHandler(type: JobType, handler: (payload: Record<string, unknown>) => Promise<void>) {
  handlers.set(type, handler)
}

/**
 * Enqueue a new job.
 */
export function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  options?: {
    delayMs?: number
    priority?: number
    maxAttempts?: number
  }
): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const job: Job = {
    id,
    type,
    payload,
    attempts: 0,
    maxAttempts: options?.maxAttempts ?? 3,
    priority: options?.priority ?? 5,
    createdAt: Date.now(),
    runAt: Date.now() + (options?.delayMs ?? 0),
    status: 'PENDING',
  }
  queue.push(job)
  queue.sort((a, b) => a.runAt - b.runAt)

  if (!processing) processQueue()

  return id
}

/**
 * Process the queue.
 */
async function processQueue() {
  if (processing) return
  processing = true

  try {
    while (queue.length > 0) {
      const job = queue[0]
      if (job.runAt > Date.now()) break

      queue.shift()
      job.status = 'PROCESSING'
      job.attempts++

      const handler = handlers.get(job.type)
      if (!handler) {
        console.warn(`[QUEUE] No handler for job type: ${job.type}`)
        job.status = 'FAILED'
        continue
      }

      try {
        await handler(job.payload)
        job.status = 'COMPLETED'
      } catch (err) {
        console.error(`[QUEUE] Job ${job.id} (${job.type}) failed:`, err)
        if (job.attempts < job.maxAttempts) {
          job.runAt = Date.now() + Math.pow(2, job.attempts) * 1000
          job.status = 'PENDING'
          queue.push(job)
          queue.sort((a, b) => a.runAt - b.runAt)
        } else {
          job.status = 'FAILED'
          console.error(`[QUEUE] Job ${job.id} permanently failed after ${job.attempts} attempts`)
        }
      }
    }
  } finally {
    processing = false
  }
}

/**
 * Get queue statistics.
 */
export function getQueueStats() {
  const pending = queue.filter((j) => j.status === 'PENDING').length
  const processing = queue.filter((j) => j.status === 'PROCESSING').length
  return {
    total: queue.length,
    pending,
    processing,
    handlers: Array.from(handlers.keys()),
  }
}

// ═══════════════════════════════════════════════════════════
// REGISTER BUILT-IN JOB HANDLERS
// ═══════════════════════════════════════════════════════════

registerJobHandler('EMAIL_SEND', async (payload) => {
  const { sendEmail, sendTemplatedEmail } = await import('@/services/notifications/email')
  if (payload.templateId) {
    await sendTemplatedEmail(payload.to as string, payload.templateId as string, payload.data as Record<string, string>)
  } else {
    await sendEmail({
      to: payload.to as string,
      subject: (payload.subject as string) || 'Bandhan Notification',
      html: (payload.html as string) || '',
    })
  }
})

registerJobHandler('SMS_SEND', async (payload) => {
  const { sendSms } = await import('@/services/notifications/sms')
  await sendSms({
    to: payload.to as string,
    message: (payload.message as string) || '',
  })
})

registerJobHandler('NOTIFICATION_PUSH', async (payload) => {
  // Handle both single push and bulk notifications
  if (payload.recipientIds) {
    const { createNotification } = await import('@/lib/notification')
    const recipientIds = payload.recipientIds as string[]
    const batchSize = 100
    for (let i = 0; i < recipientIds.length; i += batchSize) {
      const batch = recipientIds.slice(i, i + batchSize)
      await Promise.all(
        batch.map((userId) =>
          createNotification({
            userId,
            type: (payload.type as string) || 'SYSTEM',
            title: (payload.title as string) || '',
            message: (payload.message as string) || '',
            channel: (payload.channel as string) || 'IN_APP',
          })
        )
      )
    }
  } else if (payload.userId) {
    const { sendPushNotification } = await import('@/services/notifications/push')
    await sendPushNotification({
      userId: payload.userId as string,
      title: (payload.title as string) || '',
      body: (payload.body as string) || '',
      data: payload.data as Record<string, string>,
    })
  }
})

registerJobHandler('IMAGE_PROCESS', async (payload) => {
  const { processImage } = await import('@/services/media')
  const mediaPath = payload.mediaPath as string
  const category = payload.category as string
  console.log(`[IMAGE_PROCESS] Processing: ${mediaPath} (${category})`)
  const result = await processImage(mediaPath)
  if (result) {
    console.log(`[IMAGE_PROCESS] Generated: ${result.width}x${result.height}, large/medium/thumbnail`)
  }
  // Update media record with dimensions
  if (payload.mediaId && result) {
    const { db } = await import('@/lib/db')
    await db.media.update({
      where: { id: payload.mediaId as string },
      data: { width: result.width, height: result.height },
    })
  }
})

registerJobHandler('SESSION_CLEANUP', async () => {
  const { cleanExpiredSessions } = await import('@/lib/auth-middleware')
  await cleanExpiredSessions()
})

registerJobHandler('AUDIT_LOG', async (payload) => {
  const { logAudit } = await import('@/lib/audit')
  await logAudit({
    action: (payload.action as string) || 'system.job',
    entity: (payload.entity as string) || 'System',
    details: payload.details as Record<string, unknown>,
  })
})

registerJobHandler('AI_MODERATION', async (payload) => {
  const { aiModerateImage } = await import('@/services/ai')
  await aiModerateImage({
    mediaId: payload.mediaId as string,
    imageUrl: payload.imageUrl as string,
  })
})

registerJobHandler('AI_APPROVAL_CHECK', async (payload) => {
  const { aiAutoApproval } = await import('@/services/ai')
  await aiAutoApproval({ userId: payload.userId as string })
})

registerJobHandler('ADVERTISEMENT_SCHEDULE', async (payload) => {
  const { db } = await import('@/lib/db')
  const now = new Date()
  await db.advertisement.updateMany({
    where: {
      startDate: { lte: now },
      endDate: { gte: now },
      status: 'PAUSED',
    },
    data: { status: 'ACTIVE' },
  })
  await db.advertisement.updateMany({
    where: {
      endDate: { lt: now },
      status: 'ACTIVE',
    },
    data: { status: 'EXPIRED' },
    })
  console.log('[ADVERTISEMENT_SCHEDULE] Ad scheduling check complete')
})
