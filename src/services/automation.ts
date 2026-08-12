import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type TaskResult = { success: boolean; message: string; affected: number }

// ═══════════════════════════════════════════════════════════
// TASK RUNNER REGISTRY
// ═══════════════════════════════════════════════════════════

const TASK_RUNNERS: Record<string, () => Promise<TaskResult>> = {
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
// RUN ALL DUE SCHEDULED TASKS
// ═══════════════════════════════════════════════════════════

export async function runDueScheduledTasks(): Promise<{
  ran: number
  results: TaskResult[]
}> {
  const results: TaskResult[] = []
  let ran = 0
  const now = new Date()

  try {
    const dueTasks = await db.scheduledTask.findMany({
      where: {
        isEnabled: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
    })

    for (const task of dueTasks) {
      const runner = TASK_RUNNERS[task.type]
      if (!runner) {
        results.push({
          success: false,
          message: `No runner registered for task type: ${task.type}`,
          affected: 0,
        })
        // Update the task record even on skip
        await db.scheduledTask.update({
          where: { id: task.id },
          data: {
            lastRunAt: now,
            lastStatus: 'FAILED',
            lastError: `No runner for type: ${task.type}`,
            nextRunAt: task.intervalMinutes
              ? new Date(now.getTime() + task.intervalMinutes * 60 * 1000)
              : null,
          },
        })
        ran++
        continue
      }

      try {
        const result = await runner()
        results.push(result)
        ran++

        await db.scheduledTask.update({
          where: { id: task.id },
          data: {
            lastRunAt: now,
            lastStatus: result.success ? 'SUCCESS' : 'FAILED',
            lastError: result.success ? null : result.message,
            nextRunAt: task.intervalMinutes
              ? new Date(now.getTime() + task.intervalMinutes * 60 * 1000)
              : null,
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        results.push({ success: false, message, affected: 0 })
        ran++

        await db.scheduledTask.update({
          where: { id: task.id },
          data: {
            lastRunAt: now,
            lastStatus: 'FAILED',
            lastError: message,
            nextRunAt: task.intervalMinutes
              ? new Date(now.getTime() + task.intervalMinutes * 60 * 1000)
              : null,
          },
        })
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] Failed to query scheduled tasks:', message)
    results.push({ success: false, message, affected: 0 })
  }

  return { ran, results }
}

// ═══════════════════════════════════════════════════════════
// INDIVIDUAL TASK RUNNERS
// ═══════════════════════════════════════════════════════════

/**
 * Expire advertisements whose endDate has passed.
 */
export async function expireAdvertisements(): Promise<TaskResult> {
  try {
    const now = new Date()
    const result = await db.adCampaign.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: now },
      },
      data: { status: 'EXPIRED' },
    })

    if (result.count > 0) {
      await logAudit({
        action: 'scheduled.ad_expiry',
        entity: 'AdCampaign',
        details: { count: result.count },
      })
    }

    return {
      success: true,
      message: `Expired ${result.count} advertisement(s)`,
      affected: result.count,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] expireAdvertisements error:', message)
    return { success: false, message, affected: 0 }
  }
}

/**
 * Expire jobs whose expiresAt has passed.
 */
export async function expireJobs(): Promise<TaskResult> {
  try {
    const now = new Date()
    const result = await db.job.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    })

    if (result.count > 0) {
      await logAudit({
        action: 'scheduled.job_expiry',
        entity: 'Job',
        details: { count: result.count },
      })
    }

    return {
      success: true,
      message: `Expired ${result.count} job(s)`,
      affected: result.count,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] expireJobs error:', message)
    return { success: false, message, affected: 0 }
  }
}

/**
 * Expire memberships whose expiresAt has passed and downgrade user tier.
 */
export async function expireMemberships(): Promise<TaskResult> {
  try {
    const now = new Date()
    const expiringMemberships = await db.membership.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      select: { id: true, userId: true, tier: true },
    })

    if (expiringMemberships.length === 0) {
      return { success: true, message: 'No memberships to expire', affected: 0 }
    }

    // Update all expiring memberships
    const result = await db.membership.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    })

    // Downgrade each user's membership tier to FREE
    const userIds = expiringMemberships.map((m) => m.userId)
    const uniqueUserIds = [...new Set(userIds)]
    await db.user.updateMany({
      where: { id: { in: uniqueUserIds } },
      data: { membershipTier: 'FREE' },
    })

    await logAudit({
      action: 'scheduled.membership_expiry',
      entity: 'Membership',
      details: { count: result.count, userIds: uniqueUserIds },
    })

    return {
      success: true,
      message: `Expired ${result.count} membership(s), downgraded ${uniqueUserIds.length} user(s) to FREE`,
      affected: result.count,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] expireMemberships error:', message)
    return { success: false, message, affected: 0 }
  }
}

/**
 * Delete expired user sessions.
 */
export async function cleanExpiredSessions(): Promise<TaskResult> {
  try {
    const now = new Date()
    const result = await db.userSession.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    })

    if (result.count > 0) {
      await logAudit({
        action: 'scheduled.session_cleanup',
        entity: 'UserSession',
        details: { deleted: result.count },
      })
    }

    return {
      success: true,
      message: `Cleaned ${result.count} expired session(s)`,
      affected: result.count,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] cleanExpiredSessions error:', message)
    return { success: false, message, affected: 0 }
  }
}

/**
 * Clean old backup files that have expired.
 */
export async function cleanOldBackups(): Promise<TaskResult> {
  try {
    const now = new Date()
    const expiredBackups = await db.backupRecord.findMany({
      where: {
        expiresAt: { lt: now },
        status: 'COMPLETED',
      },
    })

    if (expiredBackups.length === 0) {
      return { success: true, message: 'No expired backups to clean', affected: 0 }
    }

    let filesDeleted = 0

    for (const backup of expiredBackups) {
      // Try to delete the file for DATABASE type backups
      if (backup.type === 'DATABASE' && backup.filePath) {
        try {
          if (fs.existsSync(backup.filePath)) {
            fs.unlinkSync(backup.filePath)
            filesDeleted++
          }
        } catch (fileErr) {
          console.error(
            `[AUTOMATION] Failed to delete backup file ${backup.filePath}:`,
            fileErr
          )
        }
      }

      // Update the record to reflect cleanup
      await db.backupRecord.update({
        where: { id: backup.id },
        data: {
          status: 'EXPIRED',
          filePath: null,
          fileSize: null,
        },
      })
    }

    await logAudit({
      action: 'scheduled.backup_cleanup',
      entity: 'BackupRecord',
      details: {
        recordsUpdated: expiredBackups.length,
        filesDeleted,
      },
    })

    return {
      success: true,
      message: `Cleaned ${expiredBackups.length} expired backup(s), deleted ${filesDeleted} file(s)`,
      affected: expiredBackups.length,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] cleanOldBackups error:', message)
    return { success: false, message, affected: 0 }
  }
}

/**
 * Check AI provider health by counting enabled providers and recent failures.
 */
export async function checkAIProviderHealth(): Promise<TaskResult> {
  try {
    const [enabledProviders, recentFailures] = await Promise.all([
      db.aIProviderConfig.count({ where: { enabled: true } }),
      db.aIRequest.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      }),
    ])

    const isDegraded = recentFailures > 10
    const statusMessage = isDegraded
      ? `DEGRADED: ${enabledProviders} provider(s) enabled, ${recentFailures} failures in last hour`
      : `HEALTHY: ${enabledProviders} provider(s) enabled, ${recentFailures} failures in last hour`

    await logAudit({
      action: 'scheduled.ai_provider_check',
      entity: 'AIProviderConfig',
      details: {
        enabledProviders,
        recentFailures,
        degraded: isDegraded,
      },
    })

    return {
      success: !isDegraded,
      message: statusMessage,
      affected: recentFailures,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] checkAIProviderHealth error:', message)
    return { success: false, message, affected: 0 }
  }
}

/**
 * Retry failed notifications. In production this would check an email/SMS delivery log.
 * Currently logs that the check was performed.
 */
export async function retryFailedNotifications(): Promise<TaskResult> {
  try {
    // Placeholder — the Notification model does not have delivery status tracking.
    // In production, this would query a delivery log table and re-enqueue failed messages.
    await logAudit({
      action: 'scheduled.notification_retry_check',
      entity: 'Notification',
      details: { status: 'checked', note: 'No delivery log table available — placeholder check' },
    })

    return {
      success: true,
      message: 'Notification retry check completed',
      affected: 0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] retryFailedNotifications error:', message)
    return { success: false, message, affected: 0 }
  }
}

/**
 * Remove featured status from content whose featuredExpiry has passed.
 * Affects: MatrimonyProfile, Business, Directory, Job
 */
export async function removeExpiredFeaturedContent(): Promise<TaskResult> {
  try {
    const now = new Date()
    let totalAffected = 0

    const [
      matrimonyResult,
      businessResult,
      directoryResult,
      jobResult,
    ] = await Promise.all([
      db.matrimonyProfile.updateMany({
        where: { isFeatured: true, featuredExpiry: { lt: now } },
        data: { isFeatured: false, featuredExpiry: null },
      }),
      db.business.updateMany({
        where: { isFeatured: true, featuredExpiry: { lt: now } },
        data: { isFeatured: false, featuredExpiry: null },
      }),
      db.directory.updateMany({
        where: { isFeatured: true, featuredExpiry: { lt: now } },
        data: { isFeatured: false, featuredExpiry: null },
      }),
      db.job.updateMany({
        where: { isFeatured: true, featuredExpiry: { lt: now } },
        data: { isFeatured: false, featuredExpiry: null },
      }),
    ])

    totalAffected =
      matrimonyResult.count +
      businessResult.count +
      directoryResult.count +
      jobResult.count

    if (totalAffected > 0) {
      await logAudit({
        action: 'scheduled.featured_content_expiry',
        entity: 'FeaturedContent',
        details: {
          matrimony: matrimonyResult.count,
          business: businessResult.count,
          directory: directoryResult.count,
          jobs: jobResult.count,
          total: totalAffected,
        },
      })
    }

    return {
      success: true,
      message: `Removed featured status from ${totalAffected} item(s)`,
      affected: totalAffected,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] removeExpiredFeaturedContent error:', message)
    return { success: false, message, affected: 0 }
  }
}

/**
 * Generate a daily database backup if one hasn't been created today.
 */
export async function generateDailyBackup(): Promise<TaskResult> {
  try {
    const now = new Date()

    // Start of today (midnight)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Check if a DATABASE backup was already created today
    const existingToday = await db.backupRecord.findFirst({
      where: {
        type: 'DATABASE',
        createdAt: { gte: startOfDay },
      },
    })

    if (existingToday) {
      return {
        success: true,
        message: `Daily backup already exists (created ${existingToday.createdAt.toISOString()})`,
        affected: 0,
      }
    }

    // Create backup record with IN_PROGRESS status
    const record = await db.backupRecord.create({
      data: {
        type: 'DATABASE',
        status: 'IN_PROGRESS',
        triggeredBy: 'SYSTEM',
        triggeredByRole: 'SCHEDULED_TASK',
        notes: 'Automated daily backup',
        retentionDays: 90,
        expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      },
    })

    try {
      const dbDir = path.join(process.cwd(), 'db')
      const backupsDir = path.join(dbDir, 'backups')

      // Create backups directory if not exists
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true })
      }

      const sourcePath = path.join(dbDir, 'custom.db')
      const timestamp = now.toISOString().replace(/[:.]/g, '-')
      const fileName = `backup-daily-${timestamp}.db`
      const destPath = path.join(backupsDir, fileName)

      if (!fs.existsSync(sourcePath)) {
        throw new Error('Database file not found')
      }

      // Copy the database file
      fs.copyFileSync(sourcePath, destPath)

      // Get file size
      const stats = fs.statSync(destPath)

      // Update record as completed
      await db.backupRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          filePath: destPath,
          fileSize: stats.size,
          completedAt: now,
        },
      })

      await logAudit({
        action: 'scheduled.daily_backup',
        entity: 'BackupRecord',
        entityId: record.id,
        details: { type: 'DATABASE', fileSize: stats.size, automated: true },
      })

      return {
        success: true,
        message: `Daily database backup created (${(stats.size / 1024).toFixed(1)} KB)`,
        affected: 1,
      }
    } catch (backupErr) {
      // Mark record as failed
      const errorMsg =
        backupErr instanceof Error ? backupErr.message : 'Unknown backup error'

      await db.backupRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error: errorMsg,
        },
      })

      await logAudit({
        action: 'scheduled.daily_backup_failed',
        entity: 'BackupRecord',
        entityId: record.id,
        details: { error: errorMsg },
      })

      return { success: false, message: `Daily backup failed: ${errorMsg}`, affected: 0 }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] generateDailyBackup error:', message)
    return { success: false, message, affected: 0 }
  }
}

/**
 * Run a simple database health check to verify connectivity.
 */
export async function runHealthCheck(): Promise<TaskResult> {
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1`
    const latencyMs = Date.now() - start

    const isHealthy = latencyMs < 2000
    const message = isHealthy
      ? `Database healthy (${latencyMs}ms latency)`
      : `Database degraded (${latencyMs}ms latency)`

    await logAudit({
      action: 'scheduled.health_check',
      entity: 'System',
      details: { latencyMs, healthy: isHealthy },
    })

    return {
      success: isHealthy,
      message,
      affected: 0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTOMATION] runHealthCheck error:', message)

    await logAudit({
      action: 'scheduled.health_check',
      entity: 'System',
      details: { error: message, healthy: false },
    })

    return { success: false, message: `Database health check failed: ${message}`, affected: 0 }
  }
}
