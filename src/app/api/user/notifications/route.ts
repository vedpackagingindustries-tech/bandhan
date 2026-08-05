'use server'

import { db } from '@/lib/db'
import { unauthorized, success, error } from '@/lib/api-response'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({ where: { token } })
    if (!session || session.expiresAt < new Date()) return unauthorized()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unread') === 'true'

    const where: Record<string, unknown> = { userId: session.userId }
    if (unreadOnly) where.read = false

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notification.count({ where }),
    ])

    const unreadCount = await db.notification.count({
      where: { userId: session.userId, read: false },
    })

    return success({ notifications, unreadCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (err) {
    console.error('[NOTIFICATIONS] Error:', err)
    return error('Failed to fetch notifications')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({ where: { token } })
    if (!session || session.expiresAt < new Date()) return unauthorized()

    const body = await request.json()
    const { notificationIds, markAllRead } = body

    if (markAllRead) {
      await db.notification.updateMany({
        where: { userId: session.userId, read: false },
        data: { read: true, readAt: new Date() },
      })
      return success({ markedRead: true })
    }

    if (notificationIds && notificationIds.length > 0) {
      await db.notification.updateMany({
        where: { id: { in: notificationIds }, userId: session.userId },
        data: { read: true, readAt: new Date() },
      })
      return success({ markedRead: true })
    }

    return error('Provide notificationIds or markAllRead')
  } catch (err) {
    console.error('[NOTIFICATIONS UPDATE] Error:', err)
    return error('Failed to update notifications')
  }
}