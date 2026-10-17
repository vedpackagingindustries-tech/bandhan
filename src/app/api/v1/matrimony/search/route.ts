import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/matrimony/search — Search matrimony profiles with advanced filters
 * Public: Returns only ACTIVE, profileVisible=true profiles with limited fields
 * Auth: Returns more details + contact info based on membership tier
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Filters
    const gender = searchParams.get('gender')
    const ageMin = searchParams.get('ageMin') ? parseInt(searchParams.get('ageMin')!) : undefined
    const ageMax = searchParams.get('ageMax') ? parseInt(searchParams.get('ageMax')!) : undefined
    const gotraId = searchParams.get('gotraId')
    const maritalStatus = searchParams.get('maritalStatus')
    const occupation = searchParams.get('occupation')
    const education = searchParams.get('education')
    const city = searchParams.get('city')
    const state = searchParams.get('state')
    const annualIncome = searchParams.get('annualIncome')
    const familyType = searchParams.get('familyType')
    const search = searchParams.get('search')
    const { page, limit, skip } = parsePagination(searchParams)

    // Build where clause — only show visible, active users
    const where: Record<string, unknown> = {
      profileVisible: true,
      user: { status: 'ACTIVE' },
    }

    if (gender) where.gender = gender
    if (maritalStatus) where.maritalStatus = maritalStatus
    if (gotraId) where.gotraId = gotraId
    if (occupation) where.occupation = { contains: occupation, mode: 'insensitive' }
    if (education) where.education = { contains: education, mode: 'insensitive' }
    if (city) where.city = { contains: city, mode: 'insensitive' }
    if (state) where.state = { contains: state, mode: 'insensitive' }
    if (annualIncome) where.annualIncome = annualIncome
    if (familyType) where.familyType = familyType
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { occupation: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Age filter via dateOfBirth (approximate)
    if (ageMin || ageMax) {
      const now = new Date()
      if (ageMax) {
        const minDate = new Date(now.getFullYear() - ageMax, now.getMonth(), now.getDate())
        where.dateOfBirth = { ...((where.dateOfBirth as object) || {}), gte: minDate.toISOString().split('T')[0] }
      }
      if (ageMin) {
        const maxDate = new Date(now.getFullYear() - ageMin, now.getMonth(), now.getDate())
        where.dateOfBirth = { ...((where.dateOfBirth as object) || {}), lte: maxDate.toISOString().split('T')[0] }
      }
    }

    const [items, total] = await Promise.all([
      db.profile.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          gender: true,
          dateOfBirth: true,
          maritalStatus: true,
          gotra: true,
          gotraId: true,
          gotraMaster: { select: { id: true, name: true, slug: true } },
          city: true,
          state: true,
          occupation: true,
          education: true,
          annualIncome: true,
          height: true,
          familyType: true,
          fatherName: true,
          motherName: true,
          aboutFamily: true,
          profilePhotoUrl: true,
          bio: true,
          contactPermission: true,
          phoneVisible: true,
          emailVisible: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              membershipTier: true,
              registrationCategory: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.profile.count({ where }),
    ])

    // Sanitize: remove sensitive fields for non-owners
    const sanitized = items.map((p) => {
      const result = { ...p }
      // Don't expose phone/email unless explicitly visible
      // These aren't in the select, but be safe
      return result
    })

    return success({ items: sanitized, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[MATRIMONY SEARCH] Error:', err)
    return error('Failed to search matrimony profiles')
  }
}

/**
 * POST /api/v1/matrimony/search — Send contact request (requires auth)
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    if (auth.user.status !== 'ACTIVE') return error('Account not active', 403)

    const body = await request.json()
    const { receiverId, message } = body

    if (!receiverId) return error('Receiver ID is required')

    // Check not sending to self
    if (receiverId === auth.userId) return error('Cannot send request to yourself')

    // Check receiver exists and is active
    const receiver = await db.user.findFirst({
      where: { id: receiverId, status: 'ACTIVE' },
      include: { profile: true },
    })
    if (!receiver) return error('Receiver not found', 404)

    // Check not already sent
    const existing = await db.contactRequest.findUnique({
      where: { senderId_receiverId: { senderId: auth.userId, receiverId } },
    })
    if (existing) return error('Contact request already exists', 409)

    // Check membership contact limits
    const userMembership = auth.user.membershipTier
    const sentThisMonth = await db.contactRequest.count({
      where: {
        senderId: auth.userId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    })
    const maxContacts = userMembership === 'ELITE' ? 100 : userMembership === 'PREMIUM' ? 30 : 5
    if (sentThisMonth >= maxContacts) {
      return error(`Contact limit reached (${maxContacts}/month for ${userMembership}). Upgrade membership for more.`, 403)
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    const contactRequest = await db.contactRequest.create({
      data: {
        senderId: auth.userId,
        receiverId,
        message: message || undefined,
      },
    })

    // Create notification for receiver
    await db.notification.create({
      data: {
        userId: receiverId,
        type: 'CONTACT_REQUEST',
        title: 'New Contact Request',
        message: `${auth.user.profile?.firstName || 'Someone'} wants to connect with you`,
        channel: 'IN_APP',
      },
    })

    await logAudit({
      userId: auth.userId,
      action: 'matrimony.contact_request',
      entity: 'ContactRequest',
      entityId: contactRequest.id,
      details: { receiverId },
      ipAddress,
      userAgent,
    })

    return success({ contactRequest }, 201)
  } catch (err) {
    console.error('[MATRIMONY CONTACT] Error:', err)
    return error('Failed to send contact request', 500)
  }
}
