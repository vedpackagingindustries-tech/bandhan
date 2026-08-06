import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/appointments — List appointment requests
 * POST /api/v1/appointments — Create an appointment request
 */

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams)
    const type = searchParams.get('type') || 'ALL' // SENT, RECEIVED, ALL
    const status = searchParams.get('status')

    const whereSent: Record<string, unknown> = { senderId: auth.userId }
    const whereReceived: Record<string, unknown> = { receiverId: auth.userId }

    if (status && status !== 'ALL') {
      whereSent.status = status
      whereReceived.status = status
    }

    let appointments: any[]
    let total: number

    if (type === 'SENT') {
      [appointments, total] = await Promise.all([
        db.appointmentRequest.findMany({
          where: whereSent,
          include: {
            receiver: {
              select: {
                id: true, membershipTier: true,
                profile: { select: { firstName: true, lastName: true, displayName: true, city: true, state: true, profilePhotoUrl: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip, take: limit,
        }),
        db.appointmentRequest.count({ where: whereSent }),
      ])
    } else if (type === 'RECEIVED') {
      [appointments, total] = await Promise.all([
        db.appointmentRequest.findMany({
          where: whereReceived,
          include: {
            sender: {
              select: {
                id: true, membershipTier: true,
                profile: { select: { firstName: true, lastName: true, displayName: true, city: true, state: true, profilePhotoUrl: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip, take: limit,
        }),
        db.appointmentRequest.count({ where: whereReceived }),
      ])
    } else {
      [appointments, total] = await Promise.all([
        db.appointmentRequest.findMany({
          where: {
            OR: [{ senderId: auth.userId }, { receiverId: auth.userId }],
          },
          include: {
            sender: {
              select: {
                id: true, membershipTier: true,
                profile: { select: { firstName: true, lastName: true, displayName: true, city: true, state: true, profilePhotoUrl: true } },
              },
            },
            receiver: {
              select: {
                id: true, membershipTier: true,
                profile: { select: { firstName: true, lastName: true, displayName: true, city: true, state: true, profilePhotoUrl: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip, take: limit,
        }),
        db.appointmentRequest.count({
          where: { OR: [{ senderId: auth.userId }, { receiverId: auth.userId }] },
        }),
      ])
    }

    return success({ appointments, pagination: paginate(page, limit, total) })
  } catch (err) {
    console.error('[APPOINTMENTS GET] Error:', err)
    return error('Failed to fetch appointments')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { receiverId, title, message, proposedDate, proposedTime } = body

    if (!receiverId || !title) return error('Receiver ID and title are required')
    if (receiverId === auth.userId) return error('Cannot send appointment to yourself')

    const receiver = await db.user.findUnique({ where: { id: receiverId } })
    if (!receiver) return error('Receiver not found', 404)
    if (receiver.status !== 'ACTIVE') return error('Receiver is not active')

    const { ipAddress, userAgent } = getClientInfo(request)

    const appointment = await db.appointmentRequest.create({
      data: {
        senderId: auth.userId,
        receiverId,
        title,
        message: message || null,
        proposedDate: proposedDate || null,
        proposedTime: proposedTime || null,
      },
    })

    await createNotification({
      userId: receiverId,
      type: 'APPOINTMENT',
      title: 'New Appointment Request',
      message: `You have received an appointment request: ${title}`,
      data: { appointmentId: appointment.id, senderId: auth.userId },
    })

    await logAudit({
      userId: auth.userId,
      action: 'appointment.create',
      entity: 'AppointmentRequest',
      entityId: appointment.id,
      details: { receiverId, title, proposedDate, proposedTime },
      ipAddress,
      userAgent,
    })

    return success({ appointment }, 201)
  } catch (err) {
    console.error('[APPOINTMENTS POST] Error:', err)
    return error('Failed to create appointment')
  }
}
