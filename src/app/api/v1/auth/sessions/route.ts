import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/auth/sessions — List active sessions
 * DELETE /api/v1/auth/sessions — Revoke all other sessions
 */

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const sessions = await db.userSession.findMany({
      where: { userId: auth.userId },
      select: {
        id: true,
        token: false, // Never expose full token
        device: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return success({ sessions })
  } catch (err) {
    console.error('[SESSIONS GET] Error:', err)
    return error('Failed to fetch sessions')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const { ipAddress, userAgent } = getClientInfo(request)

    // Revoke all other sessions (keep current one)
    const deleted = await db.userSession.deleteMany({
      where: {
        userId: auth.userId,
        token: { not: auth.token },
      },
    })

    await logAudit({
      userId: auth.userId,
      action: 'user.revoke_other_sessions',
      entity: 'UserSession',
      details: { sessionsRevoked: deleted.count },
      ipAddress,
      userAgent,
    })

    return success({ revokedCount: deleted.count })
  } catch (err) {
    console.error('[SESSIONS DELETE] Error:', err)
    return error('Failed to revoke sessions')
  }
}
