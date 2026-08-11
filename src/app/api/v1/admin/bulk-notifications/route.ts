import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { enqueueJob } from '@/services/queue'
import { NextRequest } from 'next/server'

/**
 * POST /api/v1/admin/bulk-notifications — Send notification to multiple users
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { title, message, type, channel, targetRoles, targetStatus, targetCategory, userIds } = body

    if (!title || !message) return error('Title and message are required')

    const validTypes = ['SYSTEM', 'APPROVAL', 'REJECTION', 'MEMBERSHIP', 'REGISTRATION', 'CONTACT_REQUEST', 'APPOINTMENT']
    const notifType = type || 'SYSTEM'
    if (!validTypes.includes(notifType)) return error('Invalid notification type')

    const validChannels = ['IN_APP', 'EMAIL', 'SMS', 'PUSH', 'BOTH']
    const notifChannel = channel || 'IN_APP'
    if (!validChannels.includes(notifChannel)) return error('Invalid channel')

    const { ipAddress, userAgent } = getClientInfo(request)

    // Build target user query
    const where: Record<string, unknown> = { status: 'ACTIVE' }
    if (targetRoles && targetRoles.length > 0) {
      where.role = { name: { in: targetRoles } }
    }
    if (targetStatus) where.status = targetStatus
    if (targetCategory) where.registrationCategory = targetCategory
    if (userIds && userIds.length > 0) where.id = { in: userIds }

    const targetUsers = await db.user.findMany({
      where,
      select: { id: true },
    })

    if (targetUsers.length === 0) return error('No matching users found')
    if (targetUsers.length > 10000) return error('Too many recipients (max 10,000)')

    // Queue the notification delivery
    const jobId = enqueueJob('NOTIFICATION_PUSH', {
      recipientIds: targetUsers.map((u) => u.id),
      title,
      message,
      type: notifType,
      channel: notifChannel,
      sentBy: auth.userId,
    })

    await logAudit({
      userId: auth.userId,
      action: 'admin.bulk_notification',
      entity: 'Notification',
      details: { title, type: notifType, channel: notifChannel, recipientCount: targetUsers.length },
      ipAddress,
      userAgent,
    })

    return success({
      message: `Notification queued for ${targetUsers.length} users`,
      recipientCount: targetUsers.length,
      jobId,
    })
  } catch (err) {
    console.error('[BULK NOTIFICATION] Error:', err)
    return error('Failed to send bulk notification')
  }
}
