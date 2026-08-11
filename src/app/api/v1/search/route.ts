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
    const gotraId = searchParams.get('gotraId')
    const education = searchParams.get('education')
    const occupation = searchParams.get('occupation')
    const maritalStatus = searchParams.get('maritalStatus')
    const familyType = searchParams.get('familyType')
    const minAge = searchParams.get('minAge') ? parseInt(searchParams.get('minAge')!) : undefined
    const maxAge = searchParams.get('maxAge') ? parseInt(searchParams.get('maxAge')!) : undefined
    const hasPhoto = searchParams.get('hasPhoto') === 'true'
    const isVerified = searchParams.get('isVerified') === 'true'
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
      gotraId: gotraId || undefined,
      education: education || undefined,
      occupation: occupation || undefined,
      maritalStatus: maritalStatus || undefined,
      familyType: familyType || undefined,
      minAge,
      maxAge,
      hasPhoto: hasPhoto || undefined,
      isVerified: isVerified || undefined,
      page,
      limit,
      sortBy: sortBy || undefined,
      sortOrder: sortOrder || undefined,
    }

    const results = await searchProfiles(params)

    // Privacy filtering: hide private profiles
    const filteredItems = (results.items as any[]).filter((item) => {
      const profile = item.profile
      if (!profile) return false
      return profile.profileVisible !== false
    })

    // Remove private fields from results, add computed age
    const sanitizedItems = filteredItems.map((item: any) => ({
      id: item.id,
      membershipTier: item.membershipTier,
      registrationCategory: item.registrationCategory,
      status: item.status,
      emailVerified: item.emailVerified,
      phoneVerified: item.phoneVerified,
      createdAt: item.createdAt,
      profile: item.profile ? {
        firstName: item.profile.firstName,
        lastName: item.profile.lastName,
        displayName: item.profile.displayName,
        gender: item.profile.gender,
        dateOfBirth: item.profile.dateOfBirth,
        city: item.profile.city,
        state: item.profile.state,
        profilePhotoUrl: item.profile.profilePhotoUrl,
        occupation: item.profile.occupation,
        education: item.profile.education,
        gotra: item.profile.gotra,
        gotraId: item.profile.gotraId,
        gotraMaster: item.profile.gotraMaster || null,
        maritalStatus: item.profile.maritalStatus,
      } : null,
    }))

    return success({
      items: sanitizedItems,
      total: results.total,
      pagination: results.pagination,
      filters: results.filters,
    })
  } catch (err) {
    console.error('[SEARCH] Error:', err)
    return error('Search failed')
  }
}
