import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════════
// MONTHLY TOP 10 PREMIUM SHOWCASE
// - Only genuine, approved, premium listings (never fake).
// - Fair, transparent scoring: premium status, completeness, views, freshness.
// - Displayed in the hero section for exactly 2 days at the month start.
// - Auto-expires; admin can regenerate and override.
// - If fewer than 10 eligible listings exist, only those are shown.
// ═══════════════════════════════════════════════════════════════

export const SHOWCASE_DISPLAY_DAYS = 2
export const TOP_N = 10

export function currentMonthKey(date = new Date()): string {
  // Asia/Kolkata month key
  const ist = new Date(date.getTime() + 5.5 * 3600000)
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthWindow(monthKey: string): { startsAt: Date; endsAt: Date } {
  const [y, m] = monthKey.split('-').map(Number)
  // Month starts in IST: first day 00:00 IST = previous day 18:30 UTC
  const startsAt = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) - 5.5 * 3600000)
  const endsAt = new Date(startsAt.getTime() + SHOWCASE_DISPLAY_DAYS * 86400000)
  return { startsAt, endsAt }
}

/** Mark expired showcase rows (auto-expiry maintenance) */
export async function expireOldShowcase(): Promise<number> {
  const res = await db.premiumShowcase.updateMany({
    where: { status: 'APPROVED', endsAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })
  return res.count
}

export interface ShowcaseCandidate {
  listingId: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  score: number
}

/**
 * Fair premium ranking:
 *  50 pts  active premium entitlement (module subscription not expired)
 *  +20 pts listing completeness
 *  +15 pts popularity (views, normalized)
 *  +10 pts freshness (newer listings score higher)
 *  +5 pts  media/photo presence
 */
export async function generateMonthlyShowcase(monthKey = currentMonthKey()): Promise<{
  generated: { MATRIMONY: number; BUSINESS: number; JOBS: number }
}> {
  const { startsAt, endsAt } = monthWindow(monthKey)
  await expireOldShowcase()

  const [matrimony, business, jobs] = await Promise.all([
    rankMatrimony(), rankBusiness(), rankJobs(),
  ])

  const generated = { MATRIMONY: 0, BUSINESS: 0, JOBS: 0 }

  const byModule: Array<[string, ShowcaseCandidate[]]> = [
    ['MATRIMONY', matrimony], ['BUSINESS', business], ['JOBS', jobs],
  ]

  for (const [module, candidates] of byModule) {
    for (const c of candidates.slice(0, TOP_N)) {
      await db.premiumShowcase.upsert({
        where: { module_listingId_monthKey: { module, listingId: c.listingId, monthKey } },
        create: {
          module, listingId: c.listingId, title: c.title, subtitle: c.subtitle,
          imageUrl: c.imageUrl, rank: 0, monthKey, score: c.score,
          startsAt, endsAt, status: 'APPROVED', selectedBy: 'AUTO',
        },
        update: { title: c.title, subtitle: c.subtitle, imageUrl: c.imageUrl, score: c.score, status: 'APPROVED', startsAt, endsAt },
      })
      generated[module as 'MATRIMONY' | 'BUSINESS' | 'JOBS']++
    }
    // Re-rank after insert
    const rows = await db.premiumShowcase.findMany({
      where: { module, monthKey },
      orderBy: { score: 'desc' },
    })
    await Promise.all(rows.map((r, i) =>
      db.premiumShowcase.update({ where: { id: r.id }, data: { rank: i + 1 } })
    ))
  }

  return { generated }
}

async function hasActivePremium(userId: string, module: string, listingId: string): Promise<boolean> {
  const sub = await db.moduleSubscription.findFirst({
    where: {
      userId, module,
      status: 'ACTIVE',
      OR: [{ listingId }, { listingId: null }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
    select: { id: true },
  })
  if (sub) return true
  // Legacy premium flags (featuredExpiry set by older payment flows)
  return false
}

async function rankMatrimony(): Promise<ShowcaseCandidate[]> {
  const rows = await db.matrimonyProfile.findMany({
    where: { status: 'APPROVED', isFeatured: true, featuredExpiry: { gt: new Date() } },
    select: {
      id: true, gender: true, occupation: true, education: true, workingCity: true, aboutMe: true, featuredExpiry: true,
      profile: { select: { userId: true, firstName: true, lastName: true, city: true, profilePhotoUrl: true, bio: true, occupation: true, education: true } },
    },
    take: 60,
  })
  const candidates: ShowcaseCandidate[] = []
  for (const r of rows) {
    const premium = await hasActivePremium(r.profile.userId, 'MATRIMONY', r.id)
    if (!premium && !(r.featuredExpiry && r.featuredExpiry > new Date())) continue
    let score = 50
    const completeness = [r.profile.firstName, r.profile.city, r.occupation || r.profile.occupation, r.education || r.profile.education, r.profile.bio || r.aboutMe].filter(Boolean).length
    score += Math.round((completeness / 5) * 20)
    const mediaCount = await db.media.count({ where: { userId: r.profile.userId, category: 'PROFILE' } })
    if (mediaCount > 0) score += 5
    const ageDays = (Date.now() - new Date(r.featuredExpiry!.getTime() - 30 * 86400000).getTime()) / 86400000
    score += Math.max(0, Math.round(10 - ageDays))
    candidates.push({
      listingId: r.id,
      title: [r.profile.firstName, r.profile.lastName].filter(Boolean).join(' ') || 'Bandhan Member',
      subtitle: [r.occupation || r.profile.occupation, r.workingCity || r.profile.city].filter(Boolean).join(' · ') || null,
      imageUrl: r.profile.profilePhotoUrl ?? null,
      score,
    })
  }
  return candidates.sort((a, b) => b.score - a.score)
}

async function rankBusiness(): Promise<ShowcaseCandidate[]> {
  const rows = await db.business.findMany({
    where: { status: 'ACTIVE', featuredExpiry: { gt: new Date() } },
    select: { id: true, ownerId: true, name: true, category: true, description: true, viewsCount: true, createdAt: true, city: { select: { name: true, nameHi: true } } },
    take: 60,
  })
  const candidates: ShowcaseCandidate[] = []
  const now = Date.now()
  for (const r of rows) {
    const premium = await hasActivePremium(r.ownerId, 'BUSINESS', r.id)
    if (!premium) continue
    let score = 50
    const completeness = [r.name, r.category, r.description].filter(Boolean).length
    score += Math.round((completeness / 3) * 20)
    score += Math.min(15, Math.round(r.viewsCount / 20))
    const ageDays = (now - new Date(r.createdAt).getTime()) / 86400000
    score += Math.max(0, Math.round(10 - ageDays))
    candidates.push({
      listingId: r.id,
      title: r.name,
      subtitle: [r.category, r.city?.nameHi || r.city?.name].filter(Boolean).join(' · ') || null,
      imageUrl: null,
      score,
    })
  }
  return candidates.sort((a, b) => b.score - a.score)
}

async function rankJobs(): Promise<ShowcaseCandidate[]> {
  const rows = await db.job.findMany({
    where: { status: 'ACTIVE', featuredExpiry: { gt: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { id: true, employerId: true, title: true, location: true, type: true, viewsCount: true, applicationsCount: true, createdAt: true },
    take: 60,
  })
  const candidates: ShowcaseCandidate[] = []
  const now = Date.now()
  for (const r of rows) {
    const premium = await hasActivePremium(r.employerId, 'JOBS', r.id)
    if (!premium) continue
    let score = 50
    score += r.title ? 10 : 0
    score += r.location ? 5 : 0
    score += Math.min(15, Math.round((r.viewsCount + r.applicationsCount * 2) / 10))
    const ageDays = (now - new Date(r.createdAt).getTime()) / 86400000
    score += Math.max(0, Math.round(10 - ageDays))
    candidates.push({
      listingId: r.id,
      title: r.title,
      subtitle: [r.type, r.location].filter(Boolean).join(' · ') || null,
      imageUrl: null,
      score,
    })
  }
  return candidates.sort((a, b) => b.score - a.score)
}
