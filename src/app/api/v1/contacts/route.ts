import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { hasPermission } from '@/lib/rbac'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/contacts — List contact requests (sent + received)
 * POST /api/v1/contacts — Send a contact request
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

    let contacts: any[]
    let total: number

    if (type === 'SENT') {
      [contacts, total] = await Promise.all([
        db.contactRequest.findMany({
          where: whereSent,
          include: {
            receiver: {
              select: {
                id: true, membershipTier: true,
                profile: { select: { firstName: true, lastName: true, displayName: true, city: true, state: true, profilePhotoUrl: true, occupation: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip, take: limit,
        }),
        db.contactRequest.count({ where: whereSent }),
      ])
    } else if (type === 'RECEIVED') {
      [contacts, total] = await Promise.all([
        db.contactRequest.findMany({
          where: whereReceived,
          include: {
            sender: {
              select: {
                id: true, membershipTier: true,
                profile: { select: { firstName: true, lastName: true, displayName: true, city: true, state: true, profilePhotoUrl: true, occupation: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip, take: limit,
        }),
        db.contactRequest.count({ where: whereReceived }),
      ])
    } else {
      [contacts, total] = await Promise.all([
        db.contactRequest.findMany({
          where: {
            OR: [{ senderId: auth.userId }, { receiverId: auth.userId }],
            ...(status && status !== 'ALL' ? { status } : {}),
          },
          include: {
            sender: {
              select: {
                id: true, membershipTier: true,
                profile: { select: { firstName: true, lastName: true, displayName: true, city: true, state: true, profilePhotoUrl: true, occupation: true } },
              },
            },
            receiver: {
              select: {
                id: true, membershipTier: true,
                profile: { select: { firstName: true, lastName: true, displayName: true, city: true, state: true, profilePhotoUrl: true, occupation: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip, take: limit,
        }),
        db.contactRequest.count({
          where: {
            OR: [{ senderId: auth.userId }, { receiverId: auth.userId }],
          },
        }),
      ])
    }

    return success({ contacts, pagination: paginate(page, limit, total) })
  } catch (err) {
    console.error('[CONTACTS GET] Error:', err)
    return error('Failed to fetch contact requests')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    // Check matrimony.contact permission
    const canContact = await hasPermission(auth.user.role?.name, 'matrimony.contact')
    if (!canContact) {
      return error('Contact request permission required. Upgrade your membership.', 403)
    }

    const body = await request.json()
    const { receiverId, message } = body

    if (!receiverId) return error('Receiver ID is required')
    if (receiverId === auth.userId) return error('Cannot send contact request to yourself')

    // Check receiver exists and is visible
    const receiver = await db.user.findUnique({
      where: { id: receiverId },
      include: { profile: true },
    })
    if (!receiver) return error('Receiver not found', 404)
    if (receiver.status !== 'ACTIVE') return error('Receiver is not active')
    if (receiver.profile && !receiver.profile.profileVisible) return error('Profile is not visible')

    // Check if already sent
    const existing = await db.contactRequest.findUnique({
      where: {
        senderId_receiverId: { senderId: auth.userId, receiverId },
      },
    })
    if (existing) return error('Contact request already sent')

    const { ipAddress, userAgent } = getClientInfo(request)

    // Check contact limit based on membership
    const activeMembership = await db.membership.findFirst({
      where: { userId: auth.userId, status: 'ACTIVE' },
      include: { /* no plan relation in schema, use user tier */ },
    })

    const sentCount = await db.contactRequest.count({
      where: { senderId: auth.userId, status: 'ACCEPTED' },
    })

    const maxContacts = auth.user.membershipTier === 'ELITE' ? 999999
      : auth.user.membershipTier === 'PREMIUM' ? 100
      : 10

    if (sentCount >= maxContacts) {
      return error(`Contact limit reached (${maxContacts}). Upgrade your membership for more contacts.`, 403)
    }

    // Create contact request
    const contact = await db.contactRequest.create({
      data: {
        senderId: auth.userId,
        receiverId,
        message: message || null,
      },
    })

    // Notify receiver
    await createNotification({
      userId: receiverId,
      type: 'CONTACT_REQUEST',
      title: 'New Contact Request',
      message: `You have received a new contact request.`,
      data: { contactRequestId: contact.id, senderId: auth.userId },
    })

    await logAudit({
      userId: auth.userId,
      action: 'contact.send',
      entity: 'ContactRequest',
      entityId: contact.id,
      details: { receiverId },
      ipAddress,
      userAgent,
    })

    return success({ contact }, 201)
  } catch (err) {
    console.error('[CONTACTS POST] Error:', err)
    return error('Failed to send contact request')
  }
}
