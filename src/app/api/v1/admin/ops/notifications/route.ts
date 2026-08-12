import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

const VALID_TYPES = ['REGISTRATION', 'APPROVAL', 'REJECTION', 'CONTACT_REQUEST', 'APPOINTMENT', 'MEMBERSHIP', 'SYSTEM']
const VALID_CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'PUSH']

// ═══════════════════════════════════════════════════════════
// GET — Admin notification management
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const userId = sp.get('userId')
    const type = sp.get('type')
    const channel = sp.get('channel')
    const statusParam = sp.get('status') // 'read' or 'unread'

    const where: Record<string, unknown> = {}

    if (userId) where.userId = userId
    if (type && VALID_TYPES.includes(type)) where.type = type
    if (channel && VALID_CHANNELS.includes(channel)) where.channel = channel
    if (statusParam === 'read') where.read = true
    if (statusParam === 'unread') where.read = false

    const [total, readCount, unreadCount, notifications] = await Promise.all([
      db.notification.count({ where }),
      db.notification.count({ where: { ...where, read: true } }),
      db.notification.count({ where: { ...where, read: false } }),
      db.notification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const data = notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      user: {
        id: n.user.id,
        email: n.user.email,
        name: n.user.profile?.displayName || null,
      },
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data,
      channel: n.channel,
      read: n.read,
      readAt: n.readAt,
      createdAt: n.createdAt,
    }))

    return success({
      notifications: data,
      stats: { total, read: readCount, unread: unreadCount },
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[NOTIFICATIONS_LIST]', err)
    return serverError()
  }
}

// ═══════════════════════════════════════════════════════════
// POST — Send bulk notification
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const body = await request.json()
    const { userIds, type, title, titleHi, message, messageHi, channel } = body

    // Validate required fields
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return error('userIds must be a non-empty array')
    }
    if (userIds.length > 500) {
      return error('Maximum 500 users per bulk notification')
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return error(`type must be one of: ${VALID_TYPES.join(', ')}`)
    }
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return error('title is required')
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return error('message is required')
    }
    if (!channel || !['IN_APP', 'EMAIL', 'SMS', 'PUSH', 'BOTH'].includes(channel)) {
      return error('channel must be one of: IN_APP, EMAIL, SMS, PUSH, BOTH')
    }

    // Verify all user IDs exist
    const existingUsers = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    })
    const validUserIds = new Set(existingUsers.map((u) => u.id))

    // Build channel list
    const channels = channel === 'BOTH' ? ['IN_APP', 'EMAIL'] : [channel]

    // Create notification records for each user x channel combination
    const notifications: Array<{
      userId: string; type: string; title: string; message: string; channel: string; data: string | null
    }> = []

    for (const uid of userIds) {
      if (!validUserIds.has(uid)) continue

      for (const ch of channels) {
        const notificationTitle = ch === 'EMAIL' && titleHi ? titleHi : title
        const notificationMessage = ch === 'EMAIL' && messageHi ? messageHi : message

        notifications.push({
          userId: uid,
          type,
          title: notificationTitle.trim(),
          message: notificationMessage.trim(),
          channel: ch,
          data: null,
        })
      }
    }

    const result = await db.notification.createMany({ data: notifications })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.user.id,
      action: 'admin.notification_send',
      entity: 'Notification',
      details: {
        type,
        channel,
        userCount: validUserIds.size,
        recordsCreated: result.count,
      },
      ipAddress,
      userAgent,
    })

    return success({ sent: result.count, userCount: validUserIds.size }, 201)
  } catch (err) {
    console.error('[NOTIFICATION_SEND]', err)
    return serverError()
  }
}
