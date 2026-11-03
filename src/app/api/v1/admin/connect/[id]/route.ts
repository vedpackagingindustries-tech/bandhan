import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// PATCH /api/v1/admin/connect/:id — Manage connection request status
// Statuses: PENDING, CONTACTED, ACCEPTED, REJECTED, CLOSED
// Records who responded, when, and via which channel the owner was informed.
// ═══════════════════════════════════════════════════════════════
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const { id } = await params

    const body = await request.json()
    const { status, adminNotes, ownerNotifiedVia } = body as {
      status?: string; adminNotes?: string; ownerNotifiedVia?: string
    }

    const VALID_STATUSES = ['PENDING', 'CONTACTED', 'ACCEPTED', 'REJECTED', 'CLOSED']
    if (!status || !VALID_STATUSES.includes(status)) {
      return error(`Status must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    const connection = await db.connectionRequest.findUnique({ where: { id } })
    if (!connection) return error('Connection request not found', 404)

    const updated = await db.connectionRequest.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes !== undefined ? adminNotes.slice(0, 1000) : connection.adminNotes,
        ownerNotifiedVia:
          ownerNotifiedVia && ['WHATSAPP', 'EMAIL', 'BOTH'].includes(ownerNotifiedVia)
            ? ownerNotifiedVia
            : connection.ownerNotifiedVia,
        ownerNotifiedAt:
          ownerNotifiedVia && ['WHATSAPP', 'EMAIL', 'BOTH'].includes(ownerNotifiedVia)
            ? new Date()
            : connection.ownerNotifiedAt,
        respondedAt: status !== 'PENDING' ? new Date() : connection.respondedAt,
        respondedById: status !== 'PENDING' ? auth.userId : connection.respondedById,
      },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: `connect.${status.toLowerCase()}`,
      entity: 'ConnectionRequest',
      entityId: id,
      details: { status, adminNotes, ownerNotifiedVia },
      ipAddress,
      userAgent,
    })

    // Notify the requester of the outcome (never reveals owner contact)
    if (['ACCEPTED', 'REJECTED', 'CLOSED'].includes(status)) {
      const messages: Record<string, { title: string; message: string }> = {
        ACCEPTED: {
          title: 'अनुरोध स्वीकृत ✓ (Request Accepted)',
          message: 'आपका कनेक्ट अनुरोध स्वीकार कर लिया गया है। प्रशासक आपसे जल्द संपर्क करेगा। (Your CONNECT request has been accepted. The administrator will contact you soon.)',
        },
        REJECTED: {
          title: 'अनुरोध अस्वीकृत (Request Declined)',
          message: 'आपका कनेक्ट अनुरोध इस लिस्टिंग के लिए स्वीकार नहीं किया गया। (Your CONNECT request was not accepted for this listing.)',
        },
        CLOSED: {
          title: 'अनुरोध बंद (Request Closed)',
          message: 'आपका कनेक्ट अनुरोध बंद कर दिया गया है। (Your CONNECT request has been closed.)',
        },
      }
      const m = messages[status]
      await createNotification({
        userId: connection.requesterId,
        type: `CONNECT_${status}`,
        title: m.title,
        message: m.message,
        channel: 'IN_APP',
        data: { connectionId: id },
      })
    }

    return success({ connection: { id: updated.id, status: updated.status }, message: `Request marked ${status}` })
  } catch (err) {
    console.error('[ADMIN CONNECT PATCH] Error:', err)
    return serverError('Failed to update connection request')
  }
}
