import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/locations — Hierarchical location data for Chhattisgarh districts/tehsils/cities
 * Supports filtering by level, parentId, and search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level') // STATE, DIVISION, DISTRICT, TEHSIL, CITY, VILLAGE
    const parentId = searchParams.get('parentId')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100')))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { isActive: true }

    if (level) where.level = level
    if (parentId) where.parentId = parentId
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { nameHi: { contains: search, mode: 'insensitive' as const } },
        { slug: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    const [items, total] = await Promise.all([
      db.location.findMany({
        where,
        select: {
          id: true,
          name: true,
          nameHi: true,
          level: true,
          parentId: true,
          slug: true,
          sortOrder: true,
          isActive: true,
          parent: { select: { id: true, name: true, nameHi: true, level: true } },
          _count: { select: { children: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      db.location.count({ where }),
    ])

    return success({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('[LOCATIONS] Error:', err)
    return error('Failed to fetch locations')
  }
}
