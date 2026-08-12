import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import {
  runDueScheduledTasks,
  expireAdvertisements,
  expireJobs,
  expireMemberships,
  cleanExpiredSessions,
  generateDailyBackup,
  runHealthCheck,
  retryFailedNotifications,
  checkAIProviderHealth,
  cleanOldBackups,
  removeExpiredFeaturedContent,
} from '@/services/automation'
import type { TaskResult } from '@/services/automation'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════
// VALID CONSTANTS
// ═══════════════════════════════════════════════════════════

const VALID_ACTIONS = ['RUN_NOW', 'ENABLE', 'DISABLE', 'UPDATE'] as const
type ValidAction = (typeof VALID_ACTIONS)[number]

const VALID_TASK_NAMES = [
  'AD_EXPIRY',
  'JOB_EXPIRY',
  'MEMBERSHIP_EXPIRY',
  'SESSION_CLEANUP',
  'BACKUP',
  'HEALTH_CHECK',
  'NOTIFICATION_RETRY',
  'AI_PROVIDER_CHECK',
] as const

// Map task names to individual runner functions
const SINGLE_TASK_RUNNERS: Record<string, () => Promise<TaskResult>> = {
  AD_EXPIRY: expireAdvertisements,
  JOB_EXPIRY: expireJobs,
  MEMBERSHIP_EXPIRY: expireMemberships,
  SESSION_CLEANUP: cleanExpiredSessions,
  BACKUP: generateDailyBackup,
  HEALTH_CHECK: runHealthCheck,
  NOTIFICATION_RETRY: retryFailedNotifications,
  AI_PROVIDER_CHECK: checkAIProviderHealth,
}

// ═══════════════════════════════════════════════════════════
// GET — List all scheduled tasks (requireSuperAdmin)
// ═══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const tasks = await db.scheduledTask.findMany({
      orderBy: { type: 'asc' },
    })

    return success({
      tasks,
      count: tasks.length,
    })
  } catch (err) {
    console.error('[SCHEDULED_TASKS] GET error:', err)
    return serverError('Failed to retrieve scheduled tasks')
  }
}

// ═══════════════════════════════════════════════════════════
// POST — Manage scheduled tasks (requireSuperAdmin)
// ═══════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const body = await request.json()
    const { action, taskName, intervalMinutes, metadata } = body

    // Validate action
    if (!action || !VALID_ACTIONS.includes(action)) {
      return error(
        `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
        400
      )
    }

    const { auth } = result
    const { ipAddress, userAgent } = getClientInfo(request)

    switch (action as ValidAction) {
      // ─── RUN NOW ──────────────────────────────────────
      case 'RUN_NOW': {
        try {
          if (!taskName) {
            // Run all due scheduled tasks
            const runResult = await runDueScheduledTasks()
            await logAudit({
              userId: auth.user.id,
              action: 'admin.scheduled_tasks_run_all',
              entity: 'ScheduledTask',
              details: { ran: runResult.ran, results: runResult.results },
              ipAddress,
              userAgent,
            })
            return success(runResult)
          }

          // Run a specific task by name
          if (!VALID_TASK_NAMES.includes(taskName)) {
            return error(
              `Invalid task name: ${taskName}. Must be one of: ${VALID_TASK_NAMES.join(', ')}`,
              400
            )
          }

          const runner = SINGLE_TASK_RUNNERS[taskName]
          if (!runner) {
            return error(`No runner available for task: ${taskName}`, 400)
          }

          const taskResult = await runner()

          // Update the scheduled task record
          const now = new Date()
          const taskRecord = await db.scheduledTask.findFirst({
            where: { type: taskName },
          })
          if (taskRecord) {
            await db.scheduledTask.update({
              where: { id: taskRecord.id },
              data: {
                lastRunAt: now,
                lastStatus: taskResult.success ? 'SUCCESS' : 'FAILED',
                lastError: taskResult.success ? null : taskResult.message,
                nextRunAt: taskRecord.intervalMinutes
                  ? new Date(now.getTime() + taskRecord.intervalMinutes * 60 * 1000)
                  : null,
              },
            })
          }

          await logAudit({
            userId: auth.user.id,
            action: 'admin.scheduled_task_run',
            entity: 'ScheduledTask',
            details: { taskName, result: taskResult },
            ipAddress,
            userAgent,
          })

          return success({ task: taskName, ...taskResult })
        } catch (runErr) {
          const message = runErr instanceof Error ? runErr.message : 'Unknown error'
          await logAudit({
            userId: auth.user.id,
            action: 'admin.scheduled_task_run_error',
            entity: 'ScheduledTask',
            details: { taskName, error: message },
            ipAddress,
            userAgent,
          })
          return serverError(`Task execution failed: ${message}`)
        }
      }

      // ─── ENABLE ──────────────────────────────────────
      case 'ENABLE': {
        if (!taskName) {
          return error('taskName is required for ENABLE action', 400)
        }

        const task = await db.scheduledTask.findFirst({ where: { type: taskName } })
        if (!task) {
          return error(`Scheduled task not found: ${taskName}`, 404)
        }

        const updated = await db.scheduledTask.update({
          where: { id: task.id },
          data: { isEnabled: true },
        })

        await logAudit({
          userId: auth.user.id,
          action: 'admin.scheduled_task_enable',
          entity: 'ScheduledTask',
          entityId: task.id,
          details: { taskName },
          ipAddress,
          userAgent,
        })

        return success(updated)
      }

      // ─── DISABLE ─────────────────────────────────────
      case 'DISABLE': {
        if (!taskName) {
          return error('taskName is required for DISABLE action', 400)
        }

        const task = await db.scheduledTask.findFirst({ where: { type: taskName } })
        if (!task) {
          return error(`Scheduled task not found: ${taskName}`, 404)
        }

        const updated = await db.scheduledTask.update({
          where: { id: task.id },
          data: { isEnabled: false },
        })

        await logAudit({
          userId: auth.user.id,
          action: 'admin.scheduled_task_disable',
          entity: 'ScheduledTask',
          entityId: task.id,
          details: { taskName },
          ipAddress,
          userAgent,
        })

        return success(updated)
      }

      // ─── UPDATE ──────────────────────────────────────
      case 'UPDATE': {
        if (!taskName) {
          return error('taskName is required for UPDATE action', 400)
        }

        const task = await db.scheduledTask.findFirst({ where: { type: taskName } })
        if (!task) {
          return error(`Scheduled task not found: ${taskName}`, 404)
        }

        const updateData: Record<string, unknown> = {}
        if (typeof intervalMinutes === 'number' && intervalMinutes > 0) {
          updateData.intervalMinutes = intervalMinutes
        }
        if (typeof metadata === 'string') {
          updateData.metadata = metadata
        }

        if (Object.keys(updateData).length === 0) {
          return error('No valid fields to update. Provide intervalMinutes or metadata.', 400)
        }

        const updated = await db.scheduledTask.update({
          where: { id: task.id },
          data: updateData,
        })

        await logAudit({
          userId: auth.user.id,
          action: 'admin.scheduled_task_update',
          entity: 'ScheduledTask',
          entityId: task.id,
          details: { taskName, updateData },
          ipAddress,
          userAgent,
        })

        return success(updated)
      }

      default: {
        return error(`Unknown action: ${action}`, 400)
      }
    }
  } catch (err) {
    console.error('[SCHEDULED_TASKS] POST error:', err)
    return serverError('Failed to manage scheduled tasks')
  }
}
