import { requireSuperAdmin } from '@/lib/auth-middleware'
import { success, serverError } from '@/lib/api-response'
import { getRecentLogs, getLogStats } from '@/services/observability'
import type { LogLevel } from '@/services/observability'
import { NextRequest } from 'next/server'

const VALID_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']

// ═══════════════════════════════════════════════════════════
// GET — Retrieve recent logs and stats from in-memory buffer
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams

    // Parse optional filters
    const rawLevel = sp.get('level')?.toUpperCase()
    const level: LogLevel | undefined = rawLevel && VALID_LEVELS.includes(rawLevel as LogLevel)
      ? (rawLevel as LogLevel)
      : undefined

    const module_ = sp.get('module') || undefined

    // Limit: default 100, max 500
    let limit = parseInt(sp.get('limit') || '100', 10)
    if (isNaN(limit) || limit < 1) limit = 100
    if (limit > 500) limit = 500

    const [logs, stats] = await Promise.all([
      Promise.resolve(getRecentLogs(level, module_, limit)),
      Promise.resolve(getLogStats()),
    ])

    return success({ logs, stats })
  } catch (err) {
    console.error('[OBSERVABILITY_API] GET error:', err)
    return serverError('Failed to retrieve observability data')
  }
}
