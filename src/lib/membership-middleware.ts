import { db } from '@/lib/db'
import { TIER_LIMITS } from '@/services/membership-limits'

type TierKey = keyof typeof TIER_LIMITS

/**
 * Check if a user has an active membership that grants access.
 * FREE users have a 5-day trial; after that, they need a paid plan.
 */
export async function checkMembershipAccess(userId: string): Promise<{
  allowed: boolean
  reason?: string
  tier: string
  expiresAt?: Date
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      membershipTier: true,
      createdAt: true,
      memberships: {
        where: { status: 'ACTIVE' },
        orderBy: { expiresAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!user) {
    return { allowed: false, reason: 'User not found', tier: 'NONE' }
  }

  const tier = (user.membershipTier || 'FREE') as TierKey

  // PREMIUM and ELITE always have access (if membership is active)
  if (tier === 'PREMIUM' || tier === 'ELITE') {
    const activeMembership = user.memberships[0]
    if (activeMembership && activeMembership.expiresAt && activeMembership.expiresAt > new Date()) {
      return { allowed: true, tier, expiresAt: activeMembership.expiresAt }
    }
    // Membership expired — downgrade to FREE
    return { allowed: true, tier: 'FREE', reason: 'Membership expired, using FREE trial' }
  }

  // FREE tier: 5-day trial from registration
  const limits = TIER_LIMITS.FREE
  const trialEnd = new Date(user.createdAt.getTime() + limits.trialDays * 24 * 60 * 60 * 1000)

  if (new Date() < trialEnd) {
    return { allowed: true, tier: 'FREE', expiresAt: trialEnd }
  }

  // Trial expired
  return {
    allowed: false,
    tier: 'FREE',
    reason: 'Your 5-day free trial has expired. Upgrade to Premium or Elite for continued access.',
  }
}

/**
 * Check if user can send a contact request this month.
 */
export async function checkContactLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  limit: number
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { membershipTier: true },
  })

  const tier = (user?.membershipTier || 'FREE') as TierKey
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.FREE
  const maxContacts = limits.monthlyContacts

  // Count contacts sent this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const sentThisMonth = await db.contactRequest.count({
    where: {
      senderId: userId,
      createdAt: { gte: startOfMonth },
    },
  })

  const remaining = Math.max(0, maxContacts - sentThisMonth)
  return { allowed: sentThisMonth < maxContacts, remaining, limit: maxContacts }
}

/**
 * Check if user can upload more photos.
 */
export async function checkPhotoLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  limit: number
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { membershipTier: true },
  })

  const tier = (user?.membershipTier || 'FREE') as TierKey
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.FREE
  const maxPhotos = limits.maxPhotos

  const currentPhotos = await db.media.count({
    where: { userId, category: 'PROFILE' },
  })

  const remaining = Math.max(0, maxPhotos - currentPhotos)
  return { allowed: currentPhotos < maxPhotos, remaining, limit: maxPhotos }
}
