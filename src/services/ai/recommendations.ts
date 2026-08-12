// ═══════════════════════════════════════════════════════════
// PERSONALIZED RECOMMENDATIONS SERVICE
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import type { RecommendationType, RecommendationItem } from './types'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

/**
 * Get personalized matrimony recommendations for a user.
 * Never recommends blocked, rejected, private, or unauthorized profiles.
 */
export async function getMatrimonyRecommendations(params: {
  userId: string
  profileId: string
  limit?: number
  locale?: 'en' | 'hi'
}): Promise<RecommendationItem[]> {
  const limit = params.limit || 20
  const locale = params.locale || 'en'

  // Get user's matrimony profile to understand preferences
  const myProfile = await db.matrimonyProfile.findUnique({
    where: { profileId: params.profileId },
    include: {
      profile: {
        select: {
          id: true, gender: true, gotraId: true, city: true, state: true,
          education: true, occupation: true,
        },
      },
    },
  })

  if (!myProfile || myProfile.status !== 'APPROVED') return []

  // Get blocked user IDs
  const blocked = await db.userBlock.findMany({
    where: { blockerId: params.profileId },
    select: { blockedId: true },
  })
  const blockedProfileIds = blocked.map(b => b.blockedId)

  // Find approved matrimony profiles of opposite gender
  const targetGender = myProfile.gender === 'MALE' ? 'FEMALE' : 'MALE'
  const candidates = await db.matrimonyProfile.findMany({
    where: {
      status: 'APPROVED',
      gender: targetGender,
      profileId: { not: params.profileId },
      profile: {
        user: { status: 'ACTIVE' },
        profileVisible: true,
        id: { notIn: blockedProfileIds },
        gotraId: myProfile.profile?.gotraId
          ? { not: myProfile.profile.gotraId } // Exclude same gotra
          : undefined,
      },
    },
    include: {
      profile: {
        select: {
          id: true, displayName: true, gender: true, dateOfBirth: true,
          gotraId: true, gotraMaster: { select: { name: true } },
          city: true, state: true, education: true, occupation: true,
          profilePhotoUrl: true, height: true,
        },
      },
      city: { select: { name: true } },
    },
    take: limit * 3, // Over-fetch for scoring
  })

  if (candidates.length === 0) return []

  // Score each candidate
  const scored = candidates.map(c => {
    let score = 0
    const factors: { name: string; weight: number; matched: boolean }[] = []
    const prefs = myProfile.partnerPreferences as Record<string, unknown> | null

    // Gotra: different = good
    if (myProfile.profile?.gotraId && c.profile.gotraId && myProfile.profile.gotraId !== c.profile.gotraId) {
      score += 20
      factors.push({ name: 'gotra', weight: 20, matched: true })
    }

    // Location proximity
    if (myProfile.cityId && c.cityId && myProfile.cityId === c.cityId) {
      score += 15
      factors.push({ name: 'location', weight: 15, matched: true })
    } else if (myProfile.cityId && c.profile.city && myProfile.profile?.city === c.profile.city) {
      score += 10
      factors.push({ name: 'location', weight: 15, matched: true })
    }

    // Education
    if (myProfile.education && c.education && myProfile.education.toLowerCase() === c.education?.toLowerCase()) {
      score += 10
      factors.push({ name: 'education', weight: 10, matched: true })
    }

    // Preference matching
    if (prefs) {
      if (prefs.education && c.education?.toLowerCase().includes((prefs.education as string).toLowerCase())) {
        score += 5
      }
      if (prefs.maritalStatus && c.maritalStatus === prefs.maritalStatus) {
        score += 5
      }
    }

    // Featured profiles get small bonus
    if (c.isFeatured) score += 3

    // Profile completeness bonus
    let completeness = 0
    if (c.aboutMe) completeness++
    if (c.height) completeness++
    if (c.education) completeness++
    if (c.occupation) completeness++
    if (c.profile?.profilePhotoUrl) completeness++
    score += Math.min(10, completeness * 2)

    score = Math.min(100, score)

    const reasons: Record<string, string> = {
      en: factors.filter(f => f.matched).map(f => {
        const names: Record<string, string> = { gotra: 'Compatible Gotra', location: 'Same area', education: 'Similar education' }
        return names[f.name] || f.name
      }).join(', ') || 'Based on your profile preferences',
      hi: factors.filter(f => f.matched).map(f => {
        const names: Record<string, string> = { gotra: 'संगत गोत्र', location: 'समान क्षेत्र', education: 'समान शिक्षा' }
        return names[f.name] || f.name
      }).join(', ') || 'आपकी प्रोफ़ाइल प्राथमिकताओं के आधार पर',
    }

    return {
      id: c.profileId,
      score,
      reason: reasons.en,
      reasonHi: reasons.hi,
      factors,
      data: {
        displayName: c.profile.displayName,
        gender: c.gender,
        city: c.city?.name || c.profile.city,
        education: c.education,
        occupation: c.occupation,
        gotra: c.profile.gotraMaster?.name,
        photoUrl: c.profile.profilePhotoUrl,
        height: c.height,
      },
    }
  })

  // Sort by score and return top N
  scored.sort((a, b) => b.score - a.score)
  const topItems = scored.slice(0, limit)

  // Persist recommendations
  try {
    await db.aIRecommendation.createMany({
      data: topItems.map(item => ({
        userId: params.userId,
        type: 'MATRIMONY' as const,
        targetId: item.id,
        score: item.score,
        factors: JSON.stringify(item.factors),
        reason: item.reason,
        reasonHi: item.reasonHi,
        expiresAt: new Date(Date.now() + 7 * 86400000), // 7 days
      })),
    })
  } catch (err) {
    console.error('[REC] Persist failed:', err)
  }

  return topItems
}

/**
 * Get job recommendations for a candidate.
 */
export async function getJobRecommendations(params: {
  userId: string
  limit?: number
  locale?: 'en' | 'hi'
}): Promise<RecommendationItem[]> {
  const limit = params.limit || 15
  const locale = params.locale || 'en'

  const profile = await db.profile.findUnique({
    where: { userId: params.userId },
    select: { id: true, education: true, occupation: true, city: true, state: true },
  })
  if (!profile) return []

  const activeJobs = await db.job.findMany({
    where: { status: 'ACTIVE' },
    include: {
      employer: { select: { profile: { select: { displayName: true } } } },
      city: { select: { name: true } },
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  })

  const scored = activeJobs.map(job => {
    let score = 0
    const factors: { name: string; weight: number; matched: boolean }[] = []

    // Location match
    if (profile.city && (job.location?.toLowerCase().includes(profile.city.toLowerCase()) || job.cityId)) {
      score += 25
      factors.push({ name: 'location', weight: 25, matched: true })
    }

    // Skills/education match
    const jobSkills = Array.isArray(job.skills) ? job.skills.map(String) : []
    const profSkills = profile.occupation ? [profile.occupation.toLowerCase()] : []
    if (profile.education) profSkills.push(profile.education.toLowerCase())
    const matchingSkills = jobSkills.filter(s => profSkills.some(ps => s.toLowerCase().includes(ps) || ps.includes(s.toLowerCase())))
    if (matchingSkills.length > 0) {
      score += Math.min(40, matchingSkills.length * 15)
      factors.push({ name: 'skills', weight: 40, matched: true })
    }

    // Featured bonus
    if (job.isFeatured) score += 5

    score = Math.min(100, score)

    return {
      id: job.id,
      score,
      reason: locale === 'hi'
        ? `${job.title} — ${factors.length > 0 ? 'आपकी प्रोफ़ाइल से मेल खाता है' : 'नया अवसर'}`
        : `${job.title} — ${factors.length > 0 ? 'matches your profile' : 'new opportunity'}`,
      reasonHi: `${job.title} — ${factors.length > 0 ? 'आपकी प्रोफ़ाइल से मेल खाता है' : 'नया अवसर'}`,
      factors,
      data: { title: job.title, category: job.category, type: job.type, location: job.location, city: job.city?.name, salaryMin: job.salaryMin, salaryMax: job.salaryMax, isFeatured: job.isFeatured },
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/**
 * Get business recommendations.
 */
export async function getBusinessRecommendations(params: {
  userId: string
  category?: string
  location?: string
  limit?: number
  locale?: 'en' | 'hi'
}): Promise<RecommendationItem[]> {
  const limit = params.limit || 15
  const locale = params.locale || 'en'

  const where: Record<string, unknown> = { status: 'ACTIVE' }
  if (params.category) (where as Record<string, unknown>).category = params.category

  const businesses = await db.business.findMany({
    where,
    include: { city: { select: { name: true } }, district: { select: { name: true } } },
    take: 50,
    orderBy: [{ isFeatured: 'desc' }, { viewsCount: 'desc' }],
  })

  const scored = businesses.map(b => {
    let score = 20 // Base score
    const isSponsored = b.isFeatured

    if (params.location && (b.city?.name?.toLowerCase().includes(params.location.toLowerCase()) || b.address?.toLowerCase().includes(params.location.toLowerCase()))) {
      score += 30
    }
    if (b.isVerified) score += 15
    if (b.isFeatured) score += 10
    score += Math.min(15, Math.floor(b.viewsCount / 100))

    return {
      id: b.id,
      score: Math.min(100, score),
      reason: locale === 'hi' ? `${b.name} — ${b.isVerified ? 'सत्यापित व्यवसाय' : 'समुदाय व्यवसाय'}` : `${b.name} — ${b.isVerified ? 'Verified business' : 'Community business'}`,
      reasonHi: `${b.name} — ${b.isVerified ? 'सत्यापित व्यवसाय' : 'समुदाय व्यवसाय'}`,
      factors: [{ name: 'relevance', weight: 50, matched: score >= 50 }],
      data: { name: b.name, category: b.category, city: b.city?.name, isVerified: b.isVerified, isSponsored },
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/**
 * Get directory recommendations.
 */
export async function getDirectoryRecommendations(params: {
  userId: string
  category?: string
  location?: string
  limit?: number
  locale?: 'en' | 'hi'
}): Promise<RecommendationItem[]> {
  const limit = params.limit || 10
  const locale = params.locale || 'en'

  const where: Record<string, unknown> = { status: 'ACTIVE' }
  if (params.category) (where as Record<string, unknown>).category = params.category

  const directories = await db.directory.findMany({
    where,
    include: { city: { select: { name: true } } },
    take: 30,
    orderBy: [{ isFeatured: 'desc' }, { viewsCount: 'desc' }],
  })

  return directories.slice(0, limit).map(d => ({
    id: d.id,
    score: 50 + (d.isVerified ? 20 : 0) + (d.isFeatured ? 15 : 0),
    reason: locale === 'hi' ? `${d.name} — सामुदायिक संगठन` : `${d.name} — Community organization`,
    reasonHi: `${d.name} — सामुदायिक संगठन`,
    factors: [{ name: 'community', weight: 50, matched: true }],
    data: { name: d.name, category: d.category, city: d.city?.name, memberCount: d.memberCount },
  }))
}

/**
 * Get recommendations by type (unified entry point).
 */
export async function getRecommendations(params: {
  userId: string
  type: RecommendationType
  limit?: number
  locale?: 'en' | 'hi'
  category?: string
  location?: string
}): Promise<{ items: RecommendationItem[]; type: RecommendationType }> {
  const profile = await db.profile.findUnique({
    where: { userId: params.userId },
    select: { id: true },
  })

  if (!profile) return { items: [], type: params.type }

  let items: RecommendationItem[] = []

  switch (params.type) {
    case 'MATRIMONY':
      items = await getMatrimonyRecommendations({
        userId: params.userId,
        profileId: profile.id,
        limit: params.limit,
        locale: params.locale,
      })
      break
    case 'JOB':
      items = await getJobRecommendations({
        userId: params.userId,
        limit: params.limit,
        locale: params.locale,
      })
      break
    case 'BUSINESS':
      items = await getBusinessRecommendations({
        userId: params.userId,
        category: params.category,
        location: params.location,
        limit: params.limit,
        locale: params.locale,
      })
      break
    case 'DIRECTORY':
      items = await getDirectoryRecommendations({
        userId: params.userId,
        category: params.category,
        location: params.location,
        limit: params.limit,
        locale: params.locale,
      })
      break
  }

  return { items, type: params.type }
}
