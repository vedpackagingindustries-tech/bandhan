// ═══════════════════════════════════════════════════════════
// STRUCTURED LOGGING & ERROR TRACKING SERVICE
// In-memory circular buffer with safe logging (no secrets)
// ═══════════════════════════════════════════════════════════

// ── Types ───────────────────────────────────────────────

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

export type LogEntry = {
  timestamp: string
  level: LogLevel
  message: string
  module: string
  userId?: string
  requestId?: string
  error?: string
  data?: Record<string, unknown>
}

export type LogStats = {
  total: number
  byLevel: Record<string, number>
  byModule: Record<string, number>
}

// ── Sensitive field blacklist ────────────────────────────
// NEVER log these fields, even if present in context data
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'otp', 'sessiontoken', 'session_token',
  'accesstoken', 'access_token', 'refreshtoken', 'refresh_token',
  'apikey', 'api_key', 'secret', 'authorization',
  'creditcard', 'credit_card', 'cvv', 'pin',
])

/** Strip sensitive keys from arbitrary context objects (shallow, recursive 1 level) */
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      clean[key] = sanitize(value as Record<string, unknown>)
    } else {
      clean[key] = value
    }
  }
  return clean
}

// ── In-memory circular buffer ────────────────────────────

const MAX_LOG_BUFFER = 1000
let logBuffer: LogEntry[] = []

/** Generate an ISO-8601 timestamp */
function now(): string {
  return new Date().toISOString()
}

// ── Core logging function ────────────────────────────────

/**
 * Core structured logger.
 * - Pushes to in-memory circular buffer (max 1000 entries).
 * - ERROR/FATAL also write to console.error.
 * - INFO also writes to console.log.
 * - NEVER logs passwords, tokens, OTPs, session tokens, credit cards, API keys.
 */
export function log(
  level: LogLevel,
  module: string,
  message: string,
  context?: Record<string, unknown>,
): void {
  // Sanitize context to remove any sensitive fields
  const safeData = context ? sanitize(context) : undefined

  // Extract error message (never stack trace in production)
  let errorMessage: string | undefined
  if (safeData?.error instanceof Error) {
    errorMessage = safeData.error.message
    delete safeData.error
  } else if (typeof safeData?.error === 'string') {
    errorMessage = safeData.error
    delete safeData.error
  }

  const entry: LogEntry = {
    timestamp: now(),
    level,
    message,
    module,
    userId: safeData?.userId as string | undefined,
    requestId: safeData?.requestId as string | undefined,
    error: errorMessage,
    data: Object.keys(safeData || {}).length > 0 ? safeData : undefined,
  }

  // Push to circular buffer
  logBuffer.push(entry)
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer = logBuffer.slice(-MAX_LOG_BUFFER)
  }

  // Console output (no stack traces)
  if (level === 'ERROR' || level === 'FATAL') {
    console.error(`[${level}] [${module}] ${message}`, errorMessage || '', safeData || '')
  } else if (level === 'WARN') {
    console.warn(`[${level}] [${module}] ${message}`, safeData || '')
  } else if (level === 'INFO') {
    console.log(`[${level}] [${module}] ${message}`)
  }
  // DEBUG: silent in production, only in dev
}

// ── Convenience functions ────────────────────────────────

export function logInfo(module: string, message: string, context?: Record<string, unknown>): void {
  log('INFO', module, message, context)
}

export function logWarn(module: string, message: string, context?: Record<string, unknown>): void {
  log('WARN', module, message, context)
}

/**
 * Log an error. Extracts error.message if an Error object is passed — never error.stack.
 */
export function logError(
  module: string,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>,
): void {
  const enriched = { ...context }
  if (error instanceof Error) {
    enriched.error = error.message
  } else if (typeof error === 'string') {
    enriched.error = error
  }
  log('ERROR', module, message, enriched)
}

// ── Query functions ──────────────────────────────────────

/**
 * Get recent logs, optionally filtered by level and/or module.
 * Returns the last `limit` entries (default: all in buffer, max 1000).
 */
export function getRecentLogs(
  level?: LogLevel,
  module?: string,
  limit?: number,
): LogEntry[] {
  let filtered = logBuffer

  if (level) {
    filtered = filtered.filter((e) => e.level === level)
  }
  if (module) {
    filtered = filtered.filter((e) => e.module === module)
  }

  if (limit && limit > 0) {
    return filtered.slice(-limit)
  }
  return filtered
}

/**
 * Get aggregate stats from the current log buffer.
 */
export function getLogStats(): LogStats {
  const byLevel: Record<string, number> = {}
  const byModule: Record<string, number> = {}

  for (const entry of logBuffer) {
    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1
    byModule[entry.module] = (byModule[entry.module] || 0) + 1
  }

  return {
    total: logBuffer.length,
    byLevel,
    byModule,
  }
}

/**
 * Clear the in-memory log buffer. Intended for testing only.
 */
export function clearLogBuffer(): void {
  logBuffer = []
}
