import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

/**
 * PATCH /api/v1/appointments/:id — Accept/Reject/Cancel/Complete an appointment
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const { id } = await params
    const body = await request.json()
    const { action } = body as { action: 'ACCEPT' | 'REJECT' | 'CANCEL' | 'COMPLETE' }

    const validActions = ['ACCEPT', 'REJECT', 'CANCEL', 'COMPLETE']
    if (!action || !validActions.includes(action)) {
      return error('Action must be ACCEPT, REJECT, CANCEL, or COMPLETE')
    }

    const appointment = await db.appointmentRequest.findUnique({ where: { id } })
    if (!appointment) return error('Appointment not found', 404)

    // Authorization checks
    if (action === 'ACCEPT' || action === 'REJECT') {
      if (appointment.receiverId !== auth.userId) {
        return error('Only the receiver can accept/reject', 403)
      }
    } else if (action === 'CANCEL') {
      if (appointment.senderId !== auth.userId && appointment.receiverId !== auth.userId) {
        return error('Not authorized', 403)
      }
    } else if (action === 'COMPLETE') {
      if (appointment.senderId !== auth.userId && appointment.receiverId !== auth.userId) {
        return error('Not authorized', 403)
      }
    }

    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      return error('Appointment is already finalized')
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    const statusMap: Record<string, string> = {
      ACCEPT: 'ACCEPTED',
      REJECT: 'REJECTED',
      CANCEL: 'CANCELLED',
      COMPLETE: 'COMPLETED',
    }

    const updated = await db.appointmentRequest.update({
      where: { id },
      data: {
        status: statusMap[action],
        respondedAt: new Date(),
      },
    })

    // Notify the other party
    const otherPartyId = action === 'ACCEPT' || action === 'REJECT'
      ? appointment.senderId
      : action === 'CANCEL'
        ? (appointment.senderId === auth.userId ? appointment.receiverId : appointment.senderId)
        : appointment.receiverId

    const notifMessages: Record<string, { title: string; message: string }> = {
      ACCEPT: { title: 'Appointment Accepted', message: `Your appointment "${appointment.title}" has been accepted.` },
      REJECT: { title: 'Appointment Rejected', message: `Your appointment "${appointment.title}" was declined.` },
      CANCEL: { title: 'Appointment Cancelled', message: `Appointment "${appointment.title}" has been cancelled.` },
      COMPLETE: { title: 'Appointment Completed', message: `Appointment "${appointment.title}" has been marked as completed.` },
    }
    const notifMsg = notifMessages[action]
    await createNotification({
      userId: otherPartyId,
      type: `APPOINTMENT_${action}`,
      title: notifMsg.title,
      message: notifMsg.message,
    })

    await logAudit({
      userId: auth.userId,
      action: `appointment.${action.toLowerCase()}`,
      entity: 'AppointmentRequest',
      entityId: id,
      details: { action, previousStatus: appointment.status },
      ipAddress,
      userAgent,
    })

    return success({ appointment: updated })
  } catch (err) {
    console.error('[APPOINTMENT ACTION] Error:', err)
    return error('Failed to process appointment')
  }
}
