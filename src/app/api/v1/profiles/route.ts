import { db } from '@/lib/db'
import { success, error, unauthorized, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/profiles — List public profiles (paginated, filtered)
 * GET /api/v1/profiles?me=true — Get own profile (auth required)
 * GET /api/v1/profiles?id=xxx — Get specific profile by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const me = searchParams.get('me') === 'true'
    const profileId = searchParams.get('id')
    const userId = searchParams.get('userId')

    // /profiles?me=true — requires auth
    if (me) {
      const result = await requireAuth(request)
      if (result.error) return result.error

      const profile = await db.profile.findUnique({
        where: { userId: result.auth.userId },
        include: {
          gotraMaster: { select: { id: true, name: true, slug: true } },
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              emailVerified: true,
              phoneVerified: true,
              membershipTier: true,
              registrationCategory: true,
              status: true,
              mustChangePassword: true,
              createdAt: true,
            },
          },
        },
      })

      if (!profile) return error('Profile not found', 404)
      return success({ profile })
    }

    // /profiles?id=xxx — get specific profile
    if (profileId) {
      const profile = await db.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          gender: true,
          maritalStatus: true,
          gotra: true,
          gotraMaster: { select: { id: true, name: true, slug: true } },
          city: true,
          state: true,
          occupation: true,
          education: true,
          designation: true,
          companyName: true,
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
            },
          },
        },
      })

      if (!profile) return error('Profile not found', 404)
      if (!profile.user) return error('Profile not found', 404)

      // Respect privacy settings
      const sanitized = { ...profile }
      return success({ profile: sanitized })
    }

    // /profiles?userId=xxx — get profile by userId
    if (userId) {
      const profile = await db.profile.findUnique({
        where: { userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          gender: true,
          maritalStatus: true,
          gotra: true,
          gotraMaster: { select: { id: true, name: true, slug: true } },
          city: true,
          state: true,
          occupation: true,
          education: true,
          profilePhotoUrl: true,
          bio: true,
          contactPermission: true,
          user: {
            select: {
              id: true,
              membershipTier: true,
              registrationCategory: true,
            },
          },
        },
      })

      if (!profile) return error('Profile not found', 404)
      return success({ profile })
    }

    // Default: list public profiles with pagination
    const search = searchParams.get('search')
    const gender = searchParams.get('gender')
    const gotraId = searchParams.get('gotraId')
    const city = searchParams.get('city')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = {
      profileVisible: true,
      user: { status: 'ACTIVE' },
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (gender) where.gender = gender
    if (gotraId) where.gotraId = gotraId
    if (city) where.city = { contains: city, mode: 'insensitive' }

    const [items, total] = await Promise.all([
      db.profile.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          gender: true,
          gotra: true,
          city: true,
          state: true,
          occupation: true,
          profilePhotoUrl: true,
          user: { select: { id: true, membershipTier: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.profile.count({ where }),
    ])

    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[PROFILES GET] Error:', err)
    return error('Failed to fetch profiles')
  }
}

/**
 * PUT /api/v1/profiles — Update own profile (auth required)
 */
export async function PUT(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    if (auth.user.status !== 'ACTIVE') return error('Account not active', 403)

    const body = await request.json()
    const {
      firstName, lastName, displayName, gender, dateOfBirth, maritalStatus,
      gotraId, address, city, state, pincode,
      occupation, education, annualIncome, companyName, designation,
      height, familyType, fatherName, motherName, familyCity, aboutFamily,
      businessName, businessCategory, businessType,
      organizationName, organizationType, organizationRole,
      bio, profilePhotoUrl, coverPhotoUrl,
      phoneVisible, emailVisible, profileVisible, contactPermission,
    } = body

    // Only allow updating fields that exist
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'firstName', 'lastName', 'displayName', 'gender', 'dateOfBirth', 'maritalStatus',
      'gotraId', 'address', 'city', 'state', 'pincode',
      'occupation', 'education', 'annualIncome', 'companyName', 'designation',
      'height', 'familyType', 'fatherName', 'motherName', 'familyCity', 'aboutFamily',
      'businessName', 'businessCategory', 'businessType',
      'organizationName', 'organizationType', 'organizationRole',
      'bio', 'profilePhotoUrl', 'coverPhotoUrl',
    ]
    const booleanFields = ['phoneVisible', 'emailVisible', 'profileVisible']
    const inputFields = {
      firstName, lastName, displayName, gender, dateOfBirth, maritalStatus,
      gotraId, address, city, state, pincode,
      occupation, education, annualIncome, companyName, designation,
      height, familyType, fatherName, motherName, familyCity, aboutFamily,
      businessName, businessCategory, businessType,
      organizationName, organizationType, organizationRole,
      bio, profilePhotoUrl, coverPhotoUrl,
      phoneVisible, emailVisible, profileVisible, contactPermission,
    }

    for (const [key, value] of Object.entries(inputFields)) {
      if (value !== undefined) {
        if (allowedFields.includes(key) || booleanFields.includes(key) || key === 'contactPermission') {
          updateData[key] = value
        }
      }
    }

    const profile = await db.profile.update({
      where: { userId: auth.userId },
      data: updateData,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'profile.update',
      entity: 'Profile',
      entityId: profile.id,
      details: { updatedFields: Object.keys(updateData) },
      ipAddress,
      userAgent,
    })

    return success({ profile })
  } catch (err) {
    console.error('[PROFILES PUT] Error:', err)
    return error('Failed to update profile', 500)
  }
}
