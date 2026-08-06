// ═══════════════════════════════════════════════════════════
// SEARCH SERVICE FOUNDATION
// Compatible with future Elasticsearch / OpenSearch migration.
// Currently uses Prisma queries. The interface abstracts
// the search implementation so only this file needs to
// change when migrating to a search engine.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { getCache, setCache } from './cache'
import { CACHE_KEYS } from './cache'

export interface SearchParams {
  query?: string
  category?: string // MATRIMONY, BUSINESS, JOB, DIRECTORY
  gender?: string
  city?: string
  state?: string
  gotra?: string
  minAge?: number
  maxAge?: number
  status?: string
  tier?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface SearchResult<T> {
  items: T[]
  total: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Build Prisma `where` clause from search params.
 * Centralizes all search filter logic.
 */
export function buildSearchWhere(params: SearchParams): Record<string, unknown> {
  const where: Record<string, unknown> = { deletedAt: null }

  if (params.status) where.status = params.status
  if (params.tier) where.membershipTier = params.tier
  if (params.category) where.registrationCategory = params.category

  // Profile-level filters
  const profileFilters: Record<string, unknown> = {}
  if (params.gender) profileFilters.gender = params.gender
  if (params.city) profileFilters.city = { contains: params.city }
  if (params.state) profileFilters.state = { contains: params.state }
  if (params.gotra) profileFilters.gotra = { contains: params.gotra }

  // Text search across email, phone, and profile fields
  if (params.query) {
    where.OR = [
      { email: { contains: params.query } },
      { phone: { contains: params.query } },
      { profile: { 
        OR: [
          { firstName: { contains: params.query } },
          { lastName: { contains: params.query } },
          { displayName: { contains: params.query } },
          { businessName: { contains: params.query } },
          { organizationName: { contains: params.query } },
          { city: { contains: params.query } },
        ],
      }},
    ]
  } else if (Object.keys(profileFilters).length > 0) {
    where.profile = profileFilters
  }

  // Exclude super admins from search results
  where.role = { name: { not: 'SUPER_ADMIN' } }

  return where
}

/**
 * Search users/profiles with filters and pagination.
 */
export async function searchProfiles(
  params: SearchParams
): Promise<SearchResult<Record<string, unknown>>> {
  const page = params.page || 1
  const limit = Math.min(100, params.limit || 20)
  const where = buildSearchWhere(params)

  const orderBy: Record<string, string> = {}
  const sortBy = params.sortBy || 'createdAt'
  const sortOrder = params.sortOrder || 'desc'
  orderBy[sortBy] = sortOrder

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        membershipTier: true,
        registrationCategory: true,
        status: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            gender: true,
            city: true,
            state: true,
            profilePhotoUrl: true,
            occupation: true,
            gotra: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ])

  return {
    items: items as unknown as Record<string, unknown>[],
    total,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

/**
 * Prepare index data for Elasticsearch/OpenSearch.
 * This is the integration point — when migrating,
 * implement the actual ES indexing here.
 */
export async function prepareSearchIndex(): Promise<{
  indexName: string
  mappings: Record<string, unknown>
  sampleDocument: Record<string, unknown>
}> {
  return {
    indexName: 'bandhan_profiles',
    mappings: {
      properties: {
        id: { type: 'keyword' },
        email: { type: 'keyword' },
        phone: { type: 'keyword' },
        status: { type: 'keyword' },
        membershipTier: { type: 'keyword' },
        registrationCategory: { type: 'keyword' },
        firstName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        lastName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        displayName: { type: 'text' },
        gender: { type: 'keyword' },
        city: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        state: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        gotra: { type: 'keyword' },
        businessName: { type: 'text' },
        organizationName: { type: 'text' },
        occupation: { type: 'text' },
        createdAt: { type: 'date' },
      },
    },
    sampleDocument: {
      id: 'sample_id',
      email: 'user@example.com',
      status: 'ACTIVE',
      membershipTier: 'FREE',
      registrationCategory: 'MATRIMONY',
      firstName: 'Sample',
      lastName: 'User',
      city: 'Raipur',
      state: 'Chhattisgarh',
      gotra: 'SampleGotra',
      createdAt: new Date().toISOString(),
    },
  }
}

/**
 * Get search suggestions (autocomplete stub).
 */
export async function getSearchSuggestions(query: string, limit = 5): Promise<string[]> {
  const cacheKey = `search:suggest:${query.toLowerCase()}`
  const cached = getCache<string[]>(cacheKey)
  if (cached) return cached

  const profiles = await db.profile.findMany({
    where: {
      OR: [
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { city: { contains: query } },
        { businessName: { contains: query } },
      ],
      profileVisible: true,
    },
    select: {
      firstName: true,
      lastName: true,
      city: true,
      businessName: true,
    },
    take: limit,
  })

  const suggestions = profiles.flatMap((p) => {
    const results: string[] = []
    if (p.firstName) results.push(p.firstName)
    if (p.lastName) results.push(p.lastName)
    if (p.city) results.push(p.city)
    if (p.businessName) results.push(p.businessName)
    return results
  }).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, limit)

  setCache(cacheKey, suggestions, 60 * 1000) // 1 min
  return suggestions
}
