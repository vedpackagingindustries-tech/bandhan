import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/**
 * POST /api/v1/matrimony/profile — Create or update matrimony profile
 * GET  /api/v1/matrimony/profile — Get own matrimony profile
 */

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    // Validate user has ACTIVE status
    if (auth.user.status !== 'ACTIVE') {
      return error('Your account must be active to create a matrimony profile', 403)
    }

    const user = auth.user
    const profile = user.profile
    if (!profile) {
      return error('User profile not found. Please complete your profile first.', 404)
    }

    const body = await request.json()
    const {
      gender,
      dateOfBirth,
      height,
      weight,
      complexion,
      maritalStatus,
      education,
      occupation,
      annualIncome,
      districtId,
      tehsilId,
      cityId,
      village,
      partnerPreferences,
      familyType,
      fatherName,
      fatherOccupation,
      motherName,
      motherOccupation,
      aboutMe,
      familyDescription,
      gotraId,
      submitForApproval,
    } = body

    // Validate gotraId if provided
    if (gotraId) {
      const gotra = await db.gotra.findUnique({ where: { id: gotraId } })
      if (!gotra || !gotra.isActive) {
        return error('Invalid or inactive gotra')
      }
    }

    // Validate districtId if provided
    if (districtId) {
      const district = await db.location.findUnique({
        where: { id: districtId },
      })
      if (!district || district.level !== 'DISTRICT' || !district.isActive) {
        return error('Invalid or inactive district')
      }
    }

    // Validate tehsilId if provided
    if (tehsilId) {
      const tehsil = await db.location.findUnique({
        where: { id: tehsilId },
      })
      if (!tehsil || tehsil.level !== 'TEHSIL' || !tehsil.isActive) {
        return error('Invalid or inactive tehsil')
      }
    }

    // Validate cityId if provided
    if (cityId) {
      const city = await db.location.findUnique({
        where: { id: cityId },
      })
      if (!city || city.level !== 'CITY' || !city.isActive) {
        return error('Invalid or inactive city')
      }
    }

    const { ipAddress, userAgent } = getClientInfo(request)

    // Update gotraId on the parent Profile if provided
    if (gotraId) {
      await db.profile.update({
        where: { id: profile.id },
        data: { gotraId },
      })
    }

    // Determine status
    let status = 'DRAFT'
    if (submitForApproval === true) {
      status = 'PENDING_APPROVAL'
    }

    // Build data for MatrimonyProfile
    const matrimonyData: Record<string, unknown> = {
      gender: gender || profile.gender || null,
      dateOfBirth: dateOfBirth || null,
      height: height || null,
      weight: weight || null,
      complexion: complexion || null,
      maritalStatus: maritalStatus || null,
      education: education || null,
      occupation: occupation || null,
      annualIncome: annualIncome || null,
      districtId: districtId || null,
      tehsilId: tehsilId || null,
      cityId: cityId || null,
      village: village || null,
      partnerPreferences: partnerPreferences ? JSON.stringify(partnerPreferences) : null,
      familyType: familyType || null,
      fatherName: fatherName || null,
      fatherOccupation: fatherOccupation || null,
      motherName: motherName || null,
      motherOccupation: motherOccupation || null,
      aboutMe: aboutMe || null,
      familyDescription: familyDescription || null,
      status,
    }

    // Check if matrimony profile already exists
    const existing = await db.matrimonyProfile.findUnique({
      where: { profileId: profile.id },
    })

    let matrimonyProfile

    if (existing) {
      // For existing profiles, only allow update if DRAFT or REJECTED
      // If PENDING_APPROVAL, don't allow changing status back to DRAFT
      if (existing.status === 'APPROVED' || existing.status === 'BLOCKED') {
        return error('Cannot update profile in current status. Contact support for changes.', 403)
      }

      // If existing is PENDING_APPROVAL and not re-submitting, keep it as is
      if (existing.status === 'PENDING_APPROVAL' && status !== 'PENDING_APPROVAL') {
        return error('Profile is pending approval. Cannot save as draft while under review.', 403)
      }

      matrimonyProfile = await db.matrimonyProfile.update({
        where: { profileId: profile.id },
        data: matrimonyData,
      })

      await logAudit({
        userId: auth.userId,
        action: 'matrimony.profile.update',
        entity: 'MatrimonyProfile',
        entityId: matrimonyProfile.id,
        details: { status },
        ipAddress,
        userAgent,
      })
    } else {
      // Create new matrimony profile
      matrimonyProfile = await db.matrimonyProfile.create({
        data: {
          profileId: profile.id,
          ...matrimonyData,
        },
      })

      await logAudit({
        userId: auth.userId,
        action: 'matrimony.profile.create',
        entity: 'MatrimonyProfile',
        entityId: matrimonyProfile.id,
        details: { status },
        ipAddress,
        userAgent,
      })
    }

    return success({ profile: matrimonyProfile }, existing ? 200 : 201)
  } catch (err) {
    console.error('[MATRIMONY PROFILE POST] Error:', err)
    return serverError('Failed to save matrimony profile')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const profile = auth.user.profile
    if (!profile) {
      return error('User profile not found', 404)
    }

    const matrimonyProfile = await db.matrimonyProfile.findUnique({
      where: { profileId: profile.id },
      include: {
        profile: {
          include: {
            gotraMaster: {
              select: { id: true, name: true, slug: true },
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
    })

    if (!matrimonyProfile) {
      return error('Matrimony profile not found', 404)
    }

    // Get media items for this user (PROFILE category, ordered by sortOrder)
    const media = await db.media.findMany({
      where: {
        userId: auth.userId,
        category: 'PROFILE',
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        url: true,
        thumbnailUrl: true,
        width: true,
        height: true,
        alt: true,
        sortOrder: true,
        isPublic: true,
      },
    })

    return success({ profile: matrimonyProfile, media })
  } catch (err) {
    console.error('[MATRIMONY PROFILE GET] Error:', err)
    return serverError('Failed to fetch matrimony profile')
  }
}
