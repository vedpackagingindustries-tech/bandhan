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
  gotra?: string       // Legacy: free-text (fallback)
  gotraId?: string    // New: Gotra master ID
  minAge?: number
  maxAge?: number
  status?: string
  tier?: string
  education?: string
  occupation?: string
  maritalStatus?: string
  familyType?: string
  annualIncomeMin?: number
  annualIncomeMax?: number
  hasPhoto?: boolean
  isVerified?: boolean
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
  filters: {
    availableCities: string[]
    availableStates: string[]
    availableGotras: string[]
    availableOccupations: string[]
    availableEducations: string[]
  }
}

/**
 * Calculate approximate age from date of birth string (YYYY-MM-DD).
 */
function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null
  const birthDate = new Date(dob)
  if (isNaN(birthDate.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
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
  if (params.gotraId) {
    profileFilters.gotraId = params.gotraId
  } else if (params.gotra) {
    // Legacy free-text fallback
    profileFilters.gotra = { contains: params.gotra }
  }
  if (params.education) profileFilters.education = { contains: params.education }
  if (params.occupation) profileFilters.occupation = { contains: params.occupation }
  if (params.maritalStatus) profileFilters.maritalStatus = params.maritalStatus
  if (params.familyType) profileFilters.familyType = params.familyType
  if (params.hasPhoto) profileFilters.profilePhotoUrl = { not: null }

  // Annual income range filter
  if (params.annualIncomeMin || params.annualIncomeMax) {
    profileFilters.annualIncome = {}
    // Annual income stored as string, parse for range comparison
    // This is a simplified filter — production would use a numeric field
  }

  // Verification filter
  if (params.isVerified) {
    where.OR = [
      { emailVerified: true },
      { phoneVerified: true },
    ]
  }

  // Text search across email, phone, and profile fields
  if (params.query) {
    const textSearch = {
      OR: [
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
            { education: { contains: params.query } },
            { occupation: { contains: params.query } },
          ],
        }},
      ],
    }
    if (where.OR) {
      where.AND = [textSearch, { OR: where.OR as any[] }]
      delete where.OR
    } else {
      Object.assign(where, textSearch)
    }
  } else if (Object.keys(profileFilters).length > 0) {
    where.profile = profileFilters
  }

  // Exclude super admins from search results
  if (!where.role) where.role = {}
  ;(where.role as Record<string, unknown>).name = { not: 'SUPER_ADMIN' }

  return where
}

/**
 * Search users/profiles with filters, pagination, sorting, and age filtering.
 * Age filtering is done in-memory since DOB is stored as string.
 */
export async function searchProfiles(
  params: SearchParams
): Promise<SearchResult<Record<string, unknown>>> {
  const page = params.page || 1
  const limit = Math.min(100, params.limit || 20)
  const where = buildSearchWhere(params)

  // Determine sort field
  const sortBy = params.sortBy || 'createdAt'
  const sortOrder = params.sortOrder || 'desc'
  const orderBy: Record<string, unknown> = {}

  // Handle profile-level sort fields
  if (['firstName', 'lastName', 'displayName', 'city', 'createdAt'].includes(sortBy)) {
    if (sortBy === 'createdAt') {
      orderBy[sortBy] = sortOrder
    } else {
      orderBy.profile = { [sortBy]: sortOrder }
    }
  } else {
    orderBy[sortBy] = sortOrder
  }

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
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
            dateOfBirth: true,
            city: true,
            state: true,
            profilePhotoUrl: true,
            occupation: true,
            education: true,
            gotraId: true,
            gotra: true,
            gotraMaster: { select: { id: true, name: true, slug: true, isActive: true } },
            maritalStatus: true,
            familyType: true,
            annualIncome: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ])

  // In-memory age filtering
  let filteredItems = items
  if (params.minAge !== undefined || params.maxAge !== undefined) {
    filteredItems = items.filter((item: any) => {
      const age = calculateAge(item.profile?.dateOfBirth)
      if (age === null) return false
      if (params.minAge !== undefined && age < params.minAge) return false
      if (params.maxAge !== undefined && age > params.maxAge) return false
      return true
    })
  }

  // Fetch available filter options for the UI (faceted search)
  // Fetch available Gotras from master table (not free-text)
  const availableGotraList = await db.gotra.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const filterData = await db.profile.findMany({
    where: { user: { status: 'ACTIVE', role: { name: { not: 'SUPER_ADMIN' } } } },
    select: { city: true, state: true, occupation: true, education: true },
    distinct: ['city'],
  })

  const availableCities = [...new Set(filterData.map((p) => p.city).filter((v): v is string => !!v))].sort().slice(0, 50)
  const availableStates = [...new Set(filterData.map((p) => p.state).filter((v): v is string => !!v))].sort().slice(0, 50)
  const availableGotras = availableGotraList.map((g) => g.name)
  const availableOccupations = [...new Set(filterData.map((p) => p.occupation).filter((v): v is string => !!v))].sort().slice(0, 50)
  const availableEducations = [...new Set(filterData.map((p) => p.education).filter((v): v is string => !!v))].sort().slice(0, 50)

  return {
    items: filteredItems as unknown as Record<string, unknown>[],
    total: params.minAge !== undefined || params.maxAge !== undefined ? filteredItems.length : total,
    pagination: {
      page,
      limit,
      total: params.minAge !== undefined || params.maxAge !== undefined ? filteredItems.length : total,
      totalPages: Math.ceil((params.minAge !== undefined || params.maxAge !== undefined ? filteredItems.length : total) / limit),
    },
    filters: {
      availableCities,
      availableStates,
      availableGotras,
      availableOccupations,
      availableEducations,
    },
  }
}

/**
 * Prepare index data for Elasticsearch/OpenSearch.
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
        education: { type: 'text' },
        maritalStatus: { type: 'keyword' },
        familyType: { type: 'keyword' },
        dateOfBirth: { type: 'date' },
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
      gender: 'MALE',
      city: 'Raipur',
      state: 'Chhattisgarh',
      gotra: 'SampleGotra',
      occupation: 'Engineer',
      education: 'B.Tech',
      maritalStatus: 'NEVER_MARRIED',
      dateOfBirth: '1995-06-15',
      createdAt: new Date().toISOString(),
    },
  }
}

/**
 * Get search suggestions (autocomplete).
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
        { occupation: { contains: query } },
        { education: { contains: query } },
      ],
      profileVisible: true,
    },
    select: {
      firstName: true,
      lastName: true,
      city: true,
      businessName: true,
      occupation: true,
      education: true,
    },
    take: limit * 2,
  })

  const suggestions = profiles.flatMap((p) => {
    const results: string[] = []
    if (p.firstName) results.push(p.firstName)
    if (p.lastName) results.push(p.lastName)
    if (p.city) results.push(p.city)
    if (p.businessName) results.push(p.businessName)
    if (p.occupation) results.push(p.occupation)
    if (p.education) results.push(p.education)
    return results
  }).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, limit)

  setCache(cacheKey, suggestions, 60 * 1000)
  return suggestions
}
