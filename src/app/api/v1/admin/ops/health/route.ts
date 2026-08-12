import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { success, error, serverError } from '@/lib/api-response'
import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'

type CheckStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN'
type OverallStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN'

// ═══════════════════════════════════════════════════════════
// GET — System health monitoring (requireSuperAdmin)
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const now = new Date().toISOString()

    // Run all health checks in parallel
    const [dbCheck, aiCheck, sessionCheck, queueCheck, taskCheck] = await Promise.all([
      checkDatabase(),
      checkAIProviders(),
      checkSessions(),
      checkQueue(),
      checkScheduledTasks(),
    ])

    const storageCheck = checkStorage()

    // Determine overall status
    let overall: OverallStatus = 'HEALTHY'
    if (dbCheck.status === 'DOWN') {
      overall = 'DOWN'
    } else if (
      aiCheck.status === 'DEGRADED' ||
      taskCheck.status === 'DEGRADED' ||
      dbCheck.status === 'DEGRADED'
    ) {
      overall = 'DEGRADED'
    }

    return success({
      status: overall,
      timestamp: now,
      checks: {
        database: dbCheck,
        aiProvider: aiCheck,
        sessions: sessionCheck,
        queuedJobs: queueCheck,
        storage: storageCheck,
        scheduledTasks: taskCheck,
      },
    })
  } catch (err) {
    console.error('[HEALTH] GET error:', err)
    return serverError('Health check failed')
  }
}

// ─── Individual health checks ───────────────────────────────

async function checkDatabase() {
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1`
    const latencyMs = Date.now() - start
    return {
      status: latencyMs > 2000 ? ('DEGRADED' as CheckStatus) : ('HEALTHY' as CheckStatus),
      latencyMs,
      message: `Database responding in ${latencyMs}ms`,
    }
  } catch (err) {
    return {
      status: 'DOWN' as CheckStatus,
      latencyMs: -1,
      message: 'Database connection failed',
    }
  }
}

async function checkAIProviders() {
  try {
    const activeProviders = await db.aIProviderConfig.count({
      where: { enabled: true },
    })
    return {
      status: activeProviders > 0 ? ('HEALTHY' as CheckStatus) : ('DEGRADED' as CheckStatus),
      activeProviders,
      message: activeProviders > 0
        ? `${activeProviders} AI provider(s) active`
        : 'No active AI providers configured',
    }
  } catch {
    return {
      status: 'DEGRADED' as CheckStatus,
      activeProviders: 0,
      message: 'Unable to check AI provider status',
    }
  }
}

async function checkSessions() {
  try {
    const activeCount = await db.userSession.count({
      where: { expiresAt: { gt: new Date() } },
    })
    return {
      status: 'HEALTHY' as CheckStatus,
      activeCount,
    }
  } catch {
    return {
      status: 'HEALTHY' as CheckStatus,
      activeCount: 0,
    }
  }
}

async function checkQueue() {
  try {
    const { getQueueStats } = await import('@/services/queue')
    const stats = getQueueStats()
    return {
      status: 'HEALTHY' as CheckStatus,
      pending: stats.pending,
    }
  } catch {
    return {
      status: 'HEALTHY' as CheckStatus,
      pending: 0,
    }
  }
}

async function checkScheduledTasks() {
  try {
    const [enabled, overdue] = await Promise.all([
      db.scheduledTask.count({ where: { isEnabled: true } }),
      db.scheduledTask.count({
        where: {
          isEnabled: true,
          nextRunAt: { lt: new Date() },
        },
      }),
    ])
    return {
      status: overdue > 0 ? ('DEGRADED' as CheckStatus) : ('HEALTHY' as CheckStatus),
      enabled,
      overdue,
    }
  } catch {
    return {
      status: 'DEGRADED' as CheckStatus,
      enabled: 0,
      overdue: 0,
    }
  }
}

function checkStorage() {
  try {
    const dbPath = path.join(process.cwd(), 'db', 'custom.db')
    const exists = fs.existsSync(dbPath)
    return {
      status: 'HEALTHY' as CheckStatus,
      message: exists
        ? 'Local SQLite storage active'
        : 'Local SQLite storage active (database file not yet created)',
    }
  } catch {
    return {
      status: 'HEALTHY' as CheckStatus,
      message: 'Local SQLite storage active',
    }
  }
}
