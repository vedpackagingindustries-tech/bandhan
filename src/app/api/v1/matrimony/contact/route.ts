import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

/**
 * POST /api/v1/matrimony/contact — Send contact request to a matrimony profile
 * GET  /api/v1/matrimony/contact — List sent/received contact requests
 */

// Monthly contact limits by membership tier
const MONTHLY_LIMITS: Record<string, number> = {
  FREE: 5,
  PREMIUM: 8,
  ELITE: 12,
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { receiverProfileId } = body

    if (!receiverProfileId) {
      return error('receiverProfileId is required')
    }

    // Find the receiver's matrimony profile
    const receiverMatrimonyProfile = await db.matrimonyProfile.findUnique({
      where: { id: receiverProfileId },
      include: {
        profile: {
          include: {
            user: {
              select: { id: true, status: true },
            },
          },
        },
      },
    })

    if (!receiverMatrimonyProfile) {
      return error('Receiver matrimony profile not found', 404)
    }

    if (receiverMatrimonyProfile.status !== 'APPROVED') {
      return error('This profile is not available for contact', 403)
    }

    const receiverUserId = receiverMatrimonyProfile.profile.userId

    // Cannot send to self
    if (receiverUserId === auth.userId) {
      return error('Cannot send contact request to yourself')
    }

    // Check receiver's user is active
    if (receiverMatrimonyProfile.profile.user.status !== 'ACTIVE') {
      return error('Receiver is not active')
    }

    // Check not blocked
    const blockRecord = await db.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: auth.userId, blockedId: receiverUserId },
          { blockerId: receiverUserId, blockedId: auth.userId },
        ],
      },
    })
    if (blockRecord) {
      return error('Cannot send contact request due to a block', 403)
    }

    // Check membership-based monthly limit
    const tier = auth.user.membershipTier || 'FREE'
    const monthlyLimit = MONTHLY_LIMITS[tier] || MONTHLY_LIMITS.FREE

    // Calculate start of current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const monthlySentCount = await db.contactRequest.count({
      where: {
        senderId: auth.userId,
        createdAt: { gte: startOfMonth },
      },
    })

    if (monthlySentCount >= monthlyLimit) {
      return error(
        `Monthly contact limit reached (${monthlyLimit}). Upgrade your membership for more contacts.`,
        403
      )
    }

    // Check not already sent
    const existing = await db.contactRequest.findUnique({
      where: {
        senderId_receiverId: { senderId: auth.userId, receiverId: receiverUserId },
      },
    })
    if (existing) {
      return error('Contact request already sent to this profile')
    }

    const { ipAddress, userAgent } = getClientInfo(request)

    // Create contact request
    const contact = await db.contactRequest.create({
      data: {
        senderId: auth.userId,
        receiverId: receiverUserId,
      },
    })

    // Send notification to receiver
    const senderProfile = auth.user.profile
    await createNotification({
      userId: receiverUserId,
      type: 'CONTACT_REQUEST',
      title: 'New Matrimony Contact Request',
      message: `You have received a new contact request${senderProfile?.displayName ? ` from ${senderProfile.displayName}` : ''}.`,
      data: {
        contactRequestId: contact.id,
        senderId: auth.userId,
        matrimonyProfileId: receiverProfileId,
      },
    })

    await logAudit({
      userId: auth.userId,
      action: 'matrimony.contact.send',
      entity: 'ContactRequest',
      entityId: contact.id,
      details: {
        receiverId: receiverUserId,
        receiverProfileId,
        monthlySentCount: monthlySentCount + 1,
        monthlyLimit,
      },
      ipAddress,
      userAgent,
    })

    return success({ contact }, 201)
  } catch (err) {
    console.error('[MATRIMONY CONTACT POST] Error:', err)
    return serverError('Failed to send contact request')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams)
    const type = searchParams.get('type') || 'all' // sent, received, all

    let where: Record<string, unknown>
    let contacts: any[]
    let total: number

    const includeProfile = {
      sender: {
        include: {
          profile: {
            include: {
              gotraMaster: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      },
      receiver: {
        include: {
          profile: {
            include: {
              gotraMaster: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      },
    }

    if (type === 'sent') {
      where = { senderId: auth.userId }
      ;[contacts, total] = await Promise.all([
        db.contactRequest.findMany({
          where,
          include: includeProfile,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.contactRequest.count({ where }),
      ])
    } else if (type === 'received') {
      where = { receiverId: auth.userId }
      ;[contacts, total] = await Promise.all([
        db.contactRequest.findMany({
          where,
          include: includeProfile,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.contactRequest.count({ where }),
      ])
    } else {
      where = {
        OR: [{ senderId: auth.userId }, { receiverId: auth.userId }],
      }
      ;[contacts, total] = await Promise.all([
        db.contactRequest.findMany({
          where,
          include: includeProfile,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.contactRequest.count({ where }),
      ])
    }

    return success({
      contacts,
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[MATRIMONY CONTACT GET] Error:', err)
    return serverError('Failed to fetch contact requests')
  }
}
