import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/locations?level=DISTRICT&parentId=xxx&search=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level')
    const parentId = searchParams.get('parentId')
    const search = searchParams.get('search')
    const districtId = searchParams.get('districtId') // shortcut for tehsils in a district

    const where: Record<string, unknown> = { isActive: true }
    if (level) where.level = level
    if (parentId) where.parentId = parentId
    if (districtId && level === 'TEHSIL') where.parentId = districtId
    if (search) where.name = { contains: search }

    const locations = await db.location.findMany({
      where,
      select: { id: true, name: true, nameHi: true, level: true, parentId: true, slug: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: 200,
    })

    return success({ locations })
  } catch (err) {
    console.error('[LOCATIONS GET] Error:', err)
    return error('Failed to fetch locations')
  }
}
