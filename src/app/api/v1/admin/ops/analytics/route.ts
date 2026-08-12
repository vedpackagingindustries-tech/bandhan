import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { success, serverError } from '@/lib/api-response'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════
// In-memory cache with 5-minute TTL
// ═══════════════════════════════════════════════════════════
type AnalyticsCache = {
  data: Record<string, unknown>
  timestamp: number
  module: string | null
}

let cache: AnalyticsCache | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ═══════════════════════════════════════════════════════════
// GET — Real-time community analytics (requireAuth — any logged-in user)
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const moduleParam = sp.get('module') ?? 'all'

    // Return cached data if still valid and same module
    if (
      cache &&
      cache.module === moduleParam &&
      Date.now() - cache.timestamp < CACHE_TTL
    ) {
      return success(cache.data)
    }

    // Build data based on module parameter
    const data: Record<string, unknown> = {}

    if (moduleParam === 'all' || moduleParam === 'matrimony') {
      const [totalProfiles, maleProfiles, femaleProfiles, featuredProfiles] = await Promise.all([
        db.matrimonyProfile.count({ where: { status: 'APPROVED' } }),
        db.matrimonyProfile.count({ where: { gender: 'MALE', status: 'APPROVED' } }),
        db.matrimonyProfile.count({ where: { gender: 'FEMALE', status: 'APPROVED' } }),
        db.matrimonyProfile.count({ where: { isFeatured: true, status: 'APPROVED' } }),
      ])
      data.matrimony = {
        totalProfiles,
        maleProfiles,
        femaleProfiles,
        featuredProfiles,
      }
    }

    if (moduleParam === 'all' || moduleParam === 'business') {
      const [totalBusinesses, verifiedBusinesses, featuredBusinesses, businessCategories] = await Promise.all([
        db.business.count({ where: { status: 'ACTIVE' } }),
        db.business.count({ where: { isVerified: true, status: 'ACTIVE' } }),
        db.business.count({ where: { isFeatured: true, status: 'ACTIVE' } }),
        db.business.groupBy({
          by: ['category'],
          where: { status: 'ACTIVE', category: { not: null } },
          _count: { category: true },
        }),
      ])
      data.business = {
        totalBusinesses,
        verifiedBusinesses,
        featuredBusinesses,
        categories: businessCategories.map((c) => ({
          category: c.category,
          count: c._count.category,
        })),
      }
    }

    if (moduleParam === 'all' || moduleParam === 'jobs') {
      const [totalJobs, featuredJobs, jobCategories] = await Promise.all([
        db.job.count({ where: { status: 'ACTIVE' } }),
        db.job.count({ where: { isFeatured: true, status: 'ACTIVE' } }),
        db.job.groupBy({
          by: ['category'],
          where: { status: 'ACTIVE', category: { not: null } },
          _count: { category: true },
        }),
      ])
      data.jobs = {
        totalJobs,
        featuredJobs,
        categories: jobCategories.map((c) => ({
          category: c.category,
          count: c._count.category,
        })),
      }
    }

    if (moduleParam === 'all' || moduleParam === 'directory') {
      const [totalListings, verifiedListings] = await Promise.all([
        db.directory.count({ where: { status: 'ACTIVE' } }),
        db.directory.count({ where: { isVerified: true, status: 'ACTIVE' } }),
      ])
      data.directory = {
        totalListings,
        verifiedListings,
      }
    }

    if (moduleParam === 'all') {
      const [totalMembers, premiumMembers, eliteMembers] = await Promise.all([
        db.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        db.user.count({ where: { membershipTier: 'PREMIUM', status: 'ACTIVE', deletedAt: null } }),
        db.user.count({ where: { membershipTier: 'ELITE', status: 'ACTIVE', deletedAt: null } }),
      ])
      data.community = {
        totalMembers,
        premiumMembers,
        eliteMembers,
      }
    }

    // Update cache
    cache = {
      data,
      timestamp: Date.now(),
      module: moduleParam,
    }

    return success(data)
  } catch (err) {
    console.error('[ANALYTICS] GET error:', err)
    return serverError('Failed to retrieve analytics')
  }
}
