import { db } from '@/lib/db'
import { success, error, forbidden, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/matrimony/:id — View a specific APPROVED matrimony profile
 */

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const { id } = await params

    const matrimonyProfile = await db.matrimonyProfile.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            gotraMaster: {
              select: { id: true, name: true, slug: true },
            },
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
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
    })

    if (!matrimonyProfile) {
      return error('Matrimony profile not found', 404)
    }

    if (matrimonyProfile.status !== 'APPROVED') {
      return error('This profile is not available for viewing', 403)
    }

    const profileOwnerUserId = matrimonyProfile.profile.userId
    const isOwner = profileOwnerUserId === auth.userId

    // Check if viewer has blocked the profile owner or vice versa
    const blockRecord = await db.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: auth.userId, blockedId: profileOwnerUserId },
          { blockerId: profileOwnerUserId, blockedId: auth.userId },
        ],
      },
    })

    if (blockRecord) {
      return forbidden('Cannot view this profile due to a block')
    }

    // Get all media items for this profile (PROFILE category)
    const media = await db.media.findMany({
      where: {
        userId: profileOwnerUserId,
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

    // Privacy: determine what contact info to show
    const ownerProfile = matrimonyProfile.profile
    const ownerUser = ownerProfile.user
    const viewerTier = auth.user.membershipTier || 'FREE'

    let showPhone = false
    let showEmail = false

    if (isOwner) {
      // Owner can always see their own info
      showPhone = true
      showEmail = true
    } else {
      // Check phone visibility
      if (ownerProfile.phoneVisible) {
        // Check contact permission based on viewer's membership tier
        switch (ownerProfile.contactPermission) {
          case 'EVERYONE':
            showPhone = true
            break
          case 'MEMBERS_ONLY':
            // Any authenticated user with a profile is a member
            showPhone = true
            break
          case 'PREMIUM_ONLY':
            showPhone = viewerTier === 'PREMIUM' || viewerTier === 'ELITE'
            break
          case 'NONE':
            showPhone = false
            break
        }
      }

      // Check email visibility
      if (ownerProfile.emailVisible) {
        switch (ownerProfile.contactPermission) {
          case 'EVERYONE':
            showEmail = true
            break
          case 'MEMBERS_ONLY':
            showEmail = true
            break
          case 'PREMIUM_ONLY':
            showEmail = viewerTier === 'PREMIUM' || viewerTier === 'ELITE'
            break
          case 'NONE':
            showEmail = false
            break
        }
      }
    }

    // Build the response - strip private fields based on privacy rules
    const responseData = {
      ...matrimonyProfile,
      profile: {
        ...ownerProfile,
        user: {
          ...ownerUser,
          // Only include contact info if allowed
          ...(showPhone ? { phone: ownerUser.phone } : { phone: null }),
          ...(showEmail ? { email: ownerUser.email } : { email: null }),
          // Always include non-contact user fields
          id: ownerUser.id,
          membershipTier: ownerUser.membershipTier,
          emailVerified: ownerUser.emailVerified,
          phoneVerified: ownerUser.phoneVerified,
        },
      },
      media,
      privacy: {
        canSeePhone: showPhone,
        canSeeEmail: showEmail,
        isOwner,
      },
    }

    return success({ profile: responseData })
  } catch (err) {
    console.error('[MATRIMONY VIEW] Error:', err)
    return serverError('Failed to fetch matrimony profile')
  }
}
