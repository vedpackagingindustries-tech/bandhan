// ═══════════════════════════════════════════════════════════
// SHARED AUTH MIDDLEWARE FOR API ROUTES
// Eliminates boilerplate session validation in every route
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { unauthorized, error } from '@/lib/api-response'
import { isAdmin as checkAdmin, isSuperAdmin } from '@/lib/rbac'
import { NextRequest } from 'next/server'
import type { User, Role, Profile } from '@prisma/client'

/** The authenticated session shape returned from Prisma */
export type AuthSession = NonNullable<Awaited<ReturnType<typeof db.userSession.findUnique>>>

/** Helper to get user from auth session */
export type AuthUser = AuthSession['user']

/**
 * Extract and validate session from Bearer token.
 * Returns the full session with user, role, and profile included.
 */
export async function authenticate(request: NextRequest): Promise<AuthSession | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null

  const session = await db.userSession.findUnique({
    where: { token },
    include: {
      user: {
        include: { role: true, profile: true },
      },
    },
  })

  if (!session || session.expiresAt < new Date()) return null
  if (session.user.status !== 'ACTIVE') return null

  return session
}

/**
 * Authenticate + require admin role (level >= ADMIN).
 */
export async function authenticateAdmin(request: NextRequest): Promise<AuthSession | null> {
  const session = await authenticate(request)
  if (!session) return null
  if (!session.user.role || !checkAdmin(session.user.role.name)) return null
  return session
}

/**
 * Authenticate + require super admin role.
 */
export async function authenticateSuperAdmin(request: NextRequest): Promise<AuthSession | null> {
  const session = await authenticate(request)
  if (!session) return null
  if (!session.user.role || !isSuperAdmin(session.user.role.name)) return null
  return session
}

/**
 * Require auth or return 401. Shorthand for routes.
 */
export async function requireAuth(request: NextRequest) {
  const session = await authenticate(request)
  if (!session) return { error: unauthorized() }
  return { auth: session }
}

/**
 * Require admin or return 403. Shorthand for routes.
 */
export async function requireAdmin(request: NextRequest) {
  const session = await authenticateAdmin(request)
  if (!session) {
    const base = await authenticate(request)
    if (!base) return { error: unauthorized() }
    return { error: error('Admin access required', 403) }
  }
  return { auth: session }
}

/**
 * Parse pagination params from URL search params.
 */
export function parsePagination(searchParams: URLSearchParams, defaults = { page: 1, limit: 20 }) {
  const page = Math.max(1, parseInt(searchParams.get('page') || String(defaults.page)))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || String(defaults.limit))))
  return { page, limit, skip: (page - 1) * limit }
}

/**
 * Build pagination response object.
 */
export function paginate(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) }
}

/**
 * Clean expired sessions. Call periodically.
 */
export async function cleanExpiredSessions() {
  const result = await db.userSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  if (result.count > 0) {
    console.log(`[CLEANUP] Removed ${result.count} expired sessions`)
  }
  return result.count
}

// Session cleanup is handled lazily via API calls, no interval needed
