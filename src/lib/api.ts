import { getSession } from '@/lib/session'

export interface ApiResult<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
  status: number
}

export type ApiResponse<T> = ApiResult<T> | ApiError

const API_BASE = '/api/v1'

function buildHeaders(custom?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...custom,
  }
  const session = getSession()
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`
  }
  return headers
}

export async function apiGet<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
  try {
    let url = `${API_BASE}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams()
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== '' && val !== null) {
          searchParams.set(key, String(val))
        }
      }
      const qs = searchParams.toString()
      if (qs) url += `?${qs}`
    }
    const res = await fetch(url, { headers: buildHeaders() })
    const json = await res.json()
    if (json.success) {
      return { ok: true, data: json.data as T }
    }
    return { ok: false, error: json.error || 'Request failed', status: res.status }
  } catch {
    return { ok: false, error: 'Network error. Please check your connection.', status: 0 }
  }
}

export async function apiPost<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (json.success) {
      return { ok: true, data: json.data as T }
    }
    return { ok: false, error: json.error || 'Request failed', status: res.status }
  } catch {
    return { ok: false, error: 'Network error. Please check your connection.', status: 0 }
  }
}

// Type-safe API response helpers

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

// Business types from actual API response
export interface BusinessListItem {
  id: string
  name: string
  description: string | null
  category: string | null
  type: string | null
  address: string | null
  phone: string | null
  website: string | null
  isVerified: boolean
  isFeatured: boolean
  viewsCount: number
  createdAt: string
  district: { id: string; name: string; nameHi: string } | null
  city: { id: string; name: string; nameHi: string } | null
}

// Job types from actual API response
export interface JobListItem {
  id: string
  title: string
  description: string
  category: string | null
  type: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  experience: string | null
  skills: string | null
  education: string | null
  vacancies: number | null
  location: string | null
  isRemote: boolean
  isFeatured: boolean
  viewsCount: number
  applicationsCount: number
  createdAt: string
  expiresAt: string | null
  employer: { id: string; profile: { firstName: string | null; lastName: string | null; businessName: string | null; companyName: string | null } } | null
  district: { id: string; name: string; nameHi: string } | null
  city: { id: string; name: string; nameHi: string } | null
}

// Directory types from actual API response
export interface DirectoryListItem {
  id: string
  name: string
  description: string | null
  category: string | null
  type: string | null
  phone: string | null
  website: string | null
  memberCount: number | null
  isVerified: boolean
  isFeatured: boolean
  viewsCount: number
  createdAt: string
  district: { id: string; name: string; nameHi: string } | null
  city: { id: string; name: string; nameHi: string } | null
}

// Matrimony profile from search API
export interface MatrimonySearchItem {
  id: string
  profileId: string
  gender: string
  dateOfBirth: string | null
  height: string | null
  weight: string | null
  complexion: string | null
  maritalStatus: string | null
  education: string | null
  occupation: string | null
  annualIncome: string | null
  aboutMe: string | null
  isFeatured: boolean
  status: string
  createdAt: string
  district: { id: string; name: string; nameHi: string; slug: string; level: string } | null
  tehsil: { id: string; name: string; nameHi: string; slug: string; level: string } | null
  city: { id: string; name: string; nameHi: string; slug: string; level: string } | null
  profile: {
    id: string
    userId: string
    firstName: string | null
    lastName: string | null
    displayName: string | null
    gender: string | null
    profilePhotoUrl: string | null
    gotraMaster: { id: string; name: string; slug: string } | null
    user: {
      id: string
      membershipTier: string | null
      emailVerified: boolean
      phoneVerified: boolean
    }
  }
  media: {
    id: string
    userId: string
    fileName: string
    url: string
    thumbnailUrl: string | null
    width: number
    height: number
    alt: string | null
    sortOrder: number
    isPublic: boolean
  } | null
}

// Gotra type
export interface GotraItem {
  id: string
  name: string
  slug: string
  isActive: boolean
}

// Location type
export interface LocationItem {
  id: string
  name: string
  nameHi: string
  level: string
  parentId: string | null
  slug: string
}
