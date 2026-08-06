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

// Job handlers registry — register actual implementations here
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
  queue.sort((a, b) => a.runAt - b.runAt) // Sort by execution time

  // Trigger processing
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
      if (job.runAt > Date.now()) break // Not ready yet

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
          // Retry with exponential backoff
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

// Job handlers are registered on-demand when needed.
// No top-level setInterval — cleanup is triggered lazily via API calls.
