import { db } from '@/lib/db'
import { success, error, serverError } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

/**
 * GET /api/v1/matrimony/search — Search APPROVED matrimony profiles
 */

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error
    const { auth } = authResult

    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams)

    // Required: gender
    const gender = searchParams.get('gender')
    if (!gender || !['MALE', 'FEMALE'].includes(gender)) {
      return error('gender is required and must be MALE or FEMALE')
    }

    // Optional filters
    const gotraId = searchParams.get('gotraId') || undefined
    const districtId = searchParams.get('districtId') || undefined
    const tehsilId = searchParams.get('tehsilId') || undefined
    const cityId = searchParams.get('cityId') || undefined
    const minAge = searchParams.get('minAge') ? parseInt(searchParams.get('minAge')!) : undefined
    const maxAge = searchParams.get('maxAge') ? parseInt(searchParams.get('maxAge')!) : undefined
    const maritalStatus = searchParams.get('maritalStatus') || undefined
    const education = searchParams.get('education') || undefined
    const occupation = searchParams.get('occupation') || undefined
    const heightMin = searchParams.get('heightMin') ? parseFloat(searchParams.get('heightMin')!) : undefined
    const heightMax = searchParams.get('heightMax') ? parseFloat(searchParams.get('heightMax')!) : undefined
    const annualIncomeMin = searchParams.get('annualIncomeMin') || undefined
    const annualIncomeMax = searchParams.get('annualIncomeMax') || undefined
    const familyType = searchParams.get('familyType') || undefined
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    // Get the authenticated user's profile ID to exclude own profile
    const myProfileId = auth.user.profile?.id

    // Get blocked user IDs (users I've blocked or who blocked me)
    const blockedRecords = await db.userBlock.findMany({
      where: {
        OR: [
          { blockerId: auth.userId },
          { blockedId: auth.userId },
        ],
      },
      select: {
        blockerId: true,
        blockedId: true,
      },
    })

    const blockedUserIds = new Set<string>()
    for (const record of blockedRecords) {
      blockedUserIds.add(record.blockerId)
      blockedUserIds.add(record.blockedId)
    }
    // Remove self from blocked set (not actually blocked, just in the result set)
    blockedUserIds.delete(auth.userId)

    // Build where clause
    const where: Prisma.MatrimonyProfileWhereInput = {
      status: 'APPROVED',
      gender,
      // Exclude own profile
      ...(myProfileId ? { profileId: { not: myProfileId } } : {}),
      // Exclude blocked users
      ...(blockedUserIds.size > 0
        ? { profile: { userId: { notIn: Array.from(blockedUserIds) } } }
        : {}),
      // Optional filters
      ...(gotraId
        ? { profile: { gotraId } }
        : {}),
      ...(districtId ? { districtId } : {}),
      ...(tehsilId ? { tehsilId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(maritalStatus ? { maritalStatus } : {}),
      ...(education ? { education } : {}),
      ...(occupation ? { occupation } : {}),
      ...(familyType ? { familyType } : {}),
      ...(annualIncomeMin || annualIncomeMax
        ? {
            annualIncome: {
              ...(annualIncomeMin ? { gte: annualIncomeMin } : {}),
              ...(annualIncomeMax ? { lte: annualIncomeMax } : {}),
            },
          }
        : {}),
    }

    // Handle age filter (computed from dateOfBirth)
    if (minAge !== undefined || maxAge !== undefined) {
      const now = new Date()
      const ageFilters: Prisma.MatrimonyProfileWhereInput[] = []

      if (minAge !== undefined) {
        // minAge means dateOfBirth should be on or before (now - minAge years)
        const maxDob = new Date(now)
        maxDob.setFullYear(maxDob.getFullYear() - minAge)
        ageFilters.push({ dateOfBirth: { lte: maxDob.toISOString().split('T')[0] } })
      }

      if (maxAge !== undefined) {
        // maxAge means dateOfBirth should be on or after (now - maxAge - 1 years)
        const minDob = new Date(now)
        minDob.setFullYear(minDob.getFullYear() - maxAge - 1)
        minDob.setDate(minDob.getDate() + 1)
        ageFilters.push({ dateOfBirth: { gte: minDob.toISOString().split('T')[0] } })
      }

      if (ageFilters.length > 0) {
        // Merge with existing gotraId filter if present
        if (gotraId) {
          where.AND = [
            { profile: { gotraId } },
            ...ageFilters,
          ]
          delete (where as Record<string, unknown>).profile
        } else {
          where.AND = ageFilters
        }
      }
    }

    // Handle height filter
    if (heightMin !== undefined || heightMax !== undefined) {
      const heightFilter: Prisma.MatrimonyProfileWhereInput = {
        height: {
          ...(heightMin !== undefined ? { gte: String(heightMin) } : {}),
          ...(heightMax !== undefined ? { lte: String(heightMax) } : {}),
        },
      }
      if (where.AND) {
        where.AND = [...(where.AND as Prisma.MatrimonyProfileWhereInput[]), heightFilter]
      } else {
        where.AND = [heightFilter]
      }
    }

    // Build orderBy
    let orderBy: Prisma.MatrimonyProfileOrderByWithRelationInput
    if (sortBy === 'height') {
      orderBy = { height: sortOrder }
    } else {
      orderBy = { createdAt: sortOrder }
    }

    // Also sort featured profiles first
    const finalOrderBy: Prisma.MatrimonyProfileOrderByWithRelationInput[] = [
      { isFeatured: 'desc' },
      orderBy,
    ]

    const [items, total] = await Promise.all([
      db.matrimonyProfile.findMany({
        where,
        include: {
          profile: {
            include: {
              gotraMaster: {
                select: { id: true, name: true, slug: true },
              },
              user: {
                select: {
                  id: true,
                  membershipTier: true,
                  emailVerified: true,
                  phoneVerified: true,
                },
              },
            },
          },
          district: {
            select: { id: true, name: true, nameHi: true, slug: true, level: true },
          },
          tehsil: {
            select: { id: true, name: true, nameHi: true, slug: true, level: true },
          },
          city: {
            select: { id: true, name: true, nameHi: true, slug: true, level: true },
          },
        },
        orderBy: finalOrderBy,
        skip,
        take: limit,
      }),
      db.matrimonyProfile.count({ where }),
    ])

    // Get first media item (PROFILE category) for each profile
    const profileUserIds = items.map((item) => item.profile.userId)
    const mediaItems = profileUserIds.length > 0
      ? await db.media.findMany({
          where: {
            userId: { in: profileUserIds },
            category: 'PROFILE',
          },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            userId: true,
            fileName: true,
            url: true,
            thumbnailUrl: true,
            width: true,
            height: true,
            alt: true,
            sortOrder: true,
            isPublic: true,
          },
        })
      : []

    // Group media by userId, take only the first one per user
    const mediaByUser = new Map<string, (typeof mediaItems)[0]>()
    for (const media of mediaItems) {
      if (!mediaByUser.has(media.userId!)) {
        mediaByUser.set(media.userId!, media)
      }
    }

    // Attach first media to each item
    const resultItems = items.map((item) => ({
      ...item,
      media: mediaByUser.get(item.profile.userId) || null,
    }))

    return success({
      items: resultItems,
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[MATRIMONY SEARCH] Error:', err)
    return serverError('Search failed')
  }
}
