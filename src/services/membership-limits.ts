import { db } from '@/lib/db'

export const TIER_LIMITS = {
  FREE:   { maxPhotos: 4,  monthlyContacts: 5,  trialDays: 5 },
  PREMIUM: { maxPhotos: 8,  monthlyContacts: 8,  trialDays: 0 },
  ELITE:  { maxPhotos: 12, monthlyContacts: 12, trialDays: 0 },
} as const

export const TIER_FEATURES = {
  FREE:    [] as string[],
  PREMIUM: ['AI_COUPLE_MATCH', 'AI_PHOTO_EDITOR'] as string[],
  ELITE:   ['AI_COUPLE_MATCH', 'AI_PHOTO_EDITOR', 'AI_ASTROLOGY'] as string[],
}

export async function canUploadPhoto(userId: string, tier: string) {
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.FREE
  const current = await db.media.count({ where: { userId, category: 'PROFILE', type: 'IMAGE' } })
  return { allowed: current < limits.maxPhotos, current, limit: limits.maxPhotos }
}

export async function canSendContact(userId: string, tier: string) {
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.FREE
  const firstOfMonth = new Date(); firstOfMonth.setDate(1); firstOfMonth.setHours(0, 0, 0, 0)
  const current = await db.contactRequest.count({ where: { senderId: userId, createdAt: { gte: firstOfMonth } } })
  return { allowed: current < limits.monthlyContacts, current, limit: limits.monthlyContacts }
}

export async function canViewProfiles(userId: string, tier: string) {
  if (tier === 'FREE') {
    const user = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
    if (user) {
      const trialEnd = new Date(user.createdAt)
      trialEnd.setDate(trialEnd.getDate() + TIER_LIMITS.FREE.trialDays)
      if (new Date() > trialEnd) return { allowed: false, reason: 'Free trial expired. Upgrade to Premium.' }
    }
  }
  return { allowed: true }
}

export function hasFeature(tier: string, feature: string): boolean {
  return (TIER_FEATURES[tier as keyof typeof TIER_FEATURES] || []).includes(feature)
}
