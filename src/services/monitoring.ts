// ═══════════════════════════════════════════════════════════
// MONITORING & HEALTH CHECK SERVICE
// Production: replace with Prometheus / DataDog / Grafana.
// ═══════════════════════════════════════════════════════════

const startTime = Date.now()
const metrics = {
  apiRequests: 0,
  apiErrors: 0,
  dbQueries: 0,
  dbSlowQueries: 0,
  activeSessions: 0,
  jobsProcessed: 0,
  jobsFailed: 0,
}

/**
 * Record an API request.
 */
export function recordApiRequest(success = true) {
  metrics.apiRequests++
  if (!success) metrics.apiErrors++
}

/**
 * Record a database query.
 */
export function recordDbQuery(slow = false) {
  metrics.dbQueries++
  if (slow) metrics.dbSlowQueries++
}

/**
 * Get system health status.
 */
export async function getHealthStatus(): Promise<{
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  uptime: number
  version: string
  checks: { name: string; status: string; latencyMs?: number; details?: string }[]
  metrics: typeof metrics
}> {
  const checks: { name: string; status: string; latencyMs?: number; details?: string }[] = []
  let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY'

  // Database check
  try {
    const start = Date.now()
    const { db } = await import('@/lib/db')
    await db.$queryRaw`SELECT 1`
    const latency = Date.now() - start
    checks.push({ name: 'database', status: latency < 500 ? 'UP' : 'SLOW', latencyMs: latency })
    if (latency >= 500) overallStatus = 'DEGRADED'
    if (latency >= 2000) overallStatus = 'UNHEALTHY'
  } catch (err) {
    checks.push({ name: 'database', status: 'DOWN', details: String(err) })
    overallStatus = 'UNHEALTHY'
  }

  // Cache check
  try {
    const { getCacheStats } = await import('./cache')
    const cacheStats = getCacheStats()
    checks.push({
      name: 'cache',
      status: 'UP',
      details: `${cacheStats.valid} entries, ${cacheStats.expired} expired`,
    })
  } catch (err) {
    checks.push({ name: 'cache', status: 'DOWN', details: String(err) })
    overallStatus = 'DEGRADED'
  }

  // Queue check
  try {
    const { getQueueStats } = await import('./queue')
    const queueStats = getQueueStats()
    checks.push({
      name: 'job_queue',
      status: 'UP',
      details: `${queueStats.pending} pending, ${queueStats.processing} processing`,
    })
  } catch (err) {
    checks.push({ name: 'job_queue', status: 'DOWN', details: String(err) })
    overallStatus = 'DEGRADED'
  }

  // Memory check
  const memUsage = process.memoryUsage()
  const memMB = Math.round(memUsage.heapUsed / (1024 * 1024))
  checks.push({
    name: 'memory',
    status: memMB < 512 ? 'UP' : 'WARNING',
    details: `${memMB}MB heap used`,
  })

  return {
    status: overallStatus,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '2.0.0-phase2',
    checks,
    metrics: { ...metrics },
  }
}

/**
 * Get performance metrics summary.
 */
export function getMetrics() {
  return {
    ...metrics,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
  }
}