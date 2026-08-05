import { db } from '@/lib/db'

export async function createNotification(params: {
  userId: string
  type: string
  title: string
  message: string
  channel?: string
  data?: Record<string, unknown>
}) {
  try {
    await db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        channel: params.channel ?? 'IN_APP',
        data: params.data ? JSON.stringify(params.data) : null,
      },
    })
  } catch (error) {
    console.error('[NOTIFICATION] Failed to create:', error)
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, read: false },
  })
}

export async function markAsRead(notificationId: string, userId: string) {
  return db.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() },
  })
}
