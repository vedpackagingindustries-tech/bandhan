import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { searchProfiles, getSearchSuggestions, type SearchParams } from '@/services/search'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const category = searchParams.get('category')
    const gender = searchParams.get('gender')
    const city = searchParams.get('city')
    const state = searchParams.get('state')
    const gotra = searchParams.get('gotra')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy')
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null
    const suggest = searchParams.get('suggest')

    // Autocomplete/suggestions endpoint
    if (suggest) {
      const suggestions = await getSearchSuggestions(suggest, 5)
      return success({ suggestions })
    }

    // Auth required for profile search (privacy)
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const params: SearchParams = {
      query: query || undefined,
      category: category || undefined,
      gender: gender || undefined,
      city: city || undefined,
      state: state || undefined,
      gotra: gotra || undefined,
      page,
      limit,
      sortBy: sortBy || undefined,
      sortOrder: sortOrder || undefined,
    }

    const results = await searchProfiles(params)

    // Privacy filtering: hide private profiles
    const filteredItems = results.items.filter((item: any) => {
      const profile = item.profile
      if (!profile) return false
      // Only show visible profiles
      return profile.profileVisible !== false
    })

    // Remove private fields from results
    const sanitizedItems = filteredItems.map((item: any) => ({
      id: item.id,
      membershipTier: item.membershipTier,
      registrationCategory: item.registrationCategory,
      status: item.status,
      createdAt: item.createdAt,
      profile: item.profile ? {
        firstName: item.profile.firstName,
        lastName: item.profile.lastName,
        displayName: item.profile.displayName,
        gender: item.profile.gender,
        city: item.profile.city,
        state: item.profile.state,
        profilePhotoUrl: item.profile.profilePhotoUrl,
        occupation: item.profile.occupation,
      } : null,
    }))

    return success({
      items: sanitizedItems,
      total: results.total,
      pagination: results.pagination,
    })
  } catch (err) {
    console.error('[SEARCH] Error:', err)
    return error('Search failed')
  }
}
