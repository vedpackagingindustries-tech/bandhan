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
                membershipTier: true,
                emailVerified: true,
                phoneVerified: true,
                // PRIVACY: owner's email/phone are NEVER returned here.
                // Contact happens exclusively through the admin-mediated CONNECT flow.
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

    // ── PRIVACY (Phase 4/9): the listing owner's phone & email are NEVER
    // sent to any viewer — not in API responses, not conditionally.
    // Ordinary browsing users use the CONNECT button; the ADMIN mediates
    // contact between the interested person and the listing owner.
    const ownerProfile = matrimonyProfile.profile
    const ownerUser = ownerProfile.user
    const isOwnerView = profileOwnerUserId === auth.userId

    // Build the response — contact fields are stripped at the API layer
    const responseData = {
      ...matrimonyProfile,
      profile: {
        ...ownerProfile,
        user: {
          id: ownerUser.id,
          membershipTier: ownerUser.membershipTier,
          emailVerified: ownerUser.emailVerified,
          phoneVerified: ownerUser.phoneVerified,
          phone: null,  // never exposed
          email: null,  // never exposed
        },
      },
      media,
      privacy: {
        canSeePhone: false,
        canSeeEmail: false,
        isOwner: isOwnerView,
        connectOnly: !isOwnerView,
        connectEnabled: true,
      },
    }

    return success({ profile: responseData })
  } catch (err) {
    console.error('[MATRIMONY VIEW] Error:', err)
    return serverError('Failed to fetch matrimony profile')
  }
}
