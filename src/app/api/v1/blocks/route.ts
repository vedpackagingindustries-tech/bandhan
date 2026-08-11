import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { blockedId, reason } = body
    if (!blockedId) return error('Blocked user ID is required')
    if (blockedId === auth.userId) return error('Cannot block yourself')

    const existing = await db.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: auth.userId, blockedId } } })
    if (existing) return error('User already blocked')

    const { ipAddress, userAgent } = getClientInfo(request)
    await db.userBlock.create({ data: { blockerId: auth.userId, blockedId, reason } })
    await logAudit({ userId: auth.userId, action: 'user.block', entity: 'UserBlock', entityId: blockedId, ipAddress, userAgent })

    return success({ message: 'User blocked' })
  } catch (err) {
    console.error('[BLOCK POST] Error:', err)
    return serverError('Failed to block user')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const blocks = await db.userBlock.findMany({
      where: { blockerId: auth.userId },
      select: { id: true, blockedId: true, reason: true, createdAt: true, blocked: { select: { profile: { select: { firstName: true, lastName: true, displayName: true, profilePhotoUrl: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    return success({ blocks })
  } catch (err) {
    console.error('[BLOCKS GET] Error:', err)
    return error('Failed to fetch blocks')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result
    const { searchParams } = new URL(request.url)
    const blockedId = searchParams.get('userId')
    if (!blockedId) return error('User ID is required')

    await db.userBlock.deleteMany({ where: { blockerId: auth.userId, blockedId } })
    return success({ message: 'User unblocked' })
  } catch (err) {
    console.error('[BLOCK DELETE] Error:', err)
    return serverError('Failed to unblock user')
  }
}
