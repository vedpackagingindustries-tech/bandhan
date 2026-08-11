import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

/**
 * PATCH /api/v1/contacts/:id — Accept/Reject a received contact request
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const { id } = await params
    const body = await request.json()
    const { action } = body as { action: 'ACCEPT' | 'REJECT' | 'BLOCK' }

    const validActions = ['ACCEPT', 'REJECT', 'BLOCK']
    if (!action || !validActions.includes(action)) {
      return error('Action must be ACCEPT, REJECT, or BLOCK')
    }

    const contact = await db.contactRequest.findUnique({ where: { id } })
    if (!contact) return error('Contact request not found', 404)

    // Only the receiver can respond
    if (contact.receiverId !== auth.userId) {
      return error('Only the receiver can respond to this request', 403)
    }

    if (contact.status !== 'PENDING') {
      return error(`Contact request is already ${contact.status.toLowerCase()}`)
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    const statusMap: Record<string, string> = {
      ACCEPT: 'ACCEPTED',
      REJECT: 'REJECTED',
      BLOCK: 'BLOCKED',
    }

    const updated = await db.contactRequest.update({
      where: { id },
      data: {
        status: statusMap[action],
        respondedAt: new Date(),
      },
    })

    // Notify sender
    const notificationMessages: Record<string, { title: string; message: string }> = {
      ACCEPT: { title: 'Contact Request Accepted', message: 'Your contact request has been accepted.' },
      REJECT: { title: 'Contact Request Rejected', message: 'Your contact request was declined.' },
      BLOCK: { title: 'Contact Request Blocked', message: 'Your contact request was blocked.' },
    }
    const notifMsg = notificationMessages[action]
    await createNotification({
      userId: contact.senderId,
      type: `CONTACT_${action}`,
      title: notifMsg.title,
      message: notifMsg.message,
    })

    await logAudit({
      userId: auth.userId,
      action: `contact.${action.toLowerCase()}`,
      entity: 'ContactRequest',
      entityId: id,
      details: { senderId: contact.senderId, action },
      ipAddress,
      userAgent,
    })

    return success({ contact: updated })
  } catch (err) {
    console.error('[CONTACT ACTION] Error:', err)
    return error('Failed to process contact request')
  }
}
