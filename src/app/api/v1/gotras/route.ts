import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/gotras
 * Returns all active Gotras for dropdown (registration, profile edit, search).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('all') === 'true'
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (!includeInactive) where.isActive = true
    if (search) where.name = { contains: search }

    const gotras = await db.gotra.findMany({
      where,
      select: { id: true, name: true, slug: true, isActive: true },
      orderBy: { name: 'asc' },
    })

    return success({ gotras, total: gotras.length })
  } catch (err) {
    console.error('[GOTRAS GET] Error:', err)
    return error('Failed to fetch Gotras')
  }
}
