import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/notifications — Get notifications for current user (auth required)
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const type = searchParams.get('type')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = { userId: result.auth.userId }
    if (unreadOnly) where.read = false
    if (type) where.type = type

    const [items, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { userId: result.auth.userId, read: false },
      }),
    ])

    return success({ items, unreadCount, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[NOTIFICATIONS GET] Error:', err)
    return error('Failed to fetch notifications')
  }
}

/**
 * PATCH /api/v1/notifications — Mark notification(s) as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const body = await request.json()
    const { id, markAll } = body

    if (markAll) {
      // Mark all as read
      const updated = await db.notification.updateMany({
        where: { userId: result.auth.userId, read: false },
        data: { read: true, readAt: new Date() },
      })
      return success({ markedCount: updated.count })
    }

    if (!id) return error('Notification ID or markAll=true required')

    // Mark single as read — verify ownership
    const notification = await db.notification.findFirst({
      where: { id, userId: result.auth.userId },
    })
    if (!notification) return error('Notification not found', 404)

    const updated = await db.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    })

    return success({ notification: updated })
  } catch (err) {
    console.error('[NOTIFICATIONS PATCH] Error:', err)
    return error('Failed to update notification', 500)
  }
}

/**
 * DELETE /api/v1/notifications — Delete a notification
 */
export async function DELETE(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return error('Notification ID required')

    const notification = await db.notification.findFirst({
      where: { id, userId: result.auth.userId },
    })
    if (!notification) return error('Notification not found', 404)

    await db.notification.delete({ where: { id } })
    return success({ deleted: true })
  } catch (err) {
    console.error('[NOTIFICATIONS DELETE] Error:', err)
    return error('Failed to delete notification', 500)
  }
}
