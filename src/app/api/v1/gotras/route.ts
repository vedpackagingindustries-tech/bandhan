import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''

    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { slug: { contains: search, mode: 'insensitive' as const } }] }
      : {}

    const [items, total] = await Promise.all([
      db.gotra.findMany({
        where,
        select: { id: true, name: true, slug: true, isActive: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      db.gotra.count({ where }),
    ])

    return success({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('[GOTRAS] Error:', err)
    return error('Failed to fetch gotras')
  }
}
