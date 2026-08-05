'use server'

import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return error('No session token')

    const { ipAddress, userAgent } = getClientInfo(request)

    const session = await db.userSession.findUnique({ where: { token } })
    if (session) {
      await logAudit({
        userId: session.userId,
        action: 'user.logout',
        entity: 'UserSession',
        entityId: session.id,
        ipAddress,
        userAgent,
      })

      await db.userSession.delete({ where: { token } })
    }

    return success({ loggedOut: true })
  } catch (err) {
    console.error('[LOGOUT] Error:', err)
    return error('Logout failed')
  }
}