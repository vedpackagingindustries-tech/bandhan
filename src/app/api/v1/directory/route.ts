import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const districtId = searchParams.get('districtId')
    const isVerified = searchParams.get('verified') === 'true'
    const search = searchParams.get('search')
    const isFeatured = searchParams.get('featured') === 'true'
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = { status: 'ACTIVE' }
    if (category) where.category = category
    if (districtId) where.districtId = districtId
    if (isVerified) where.isVerified = true
    if (isFeatured) where.isFeatured = true
    if (search) where.name = { contains: search }

    const [items, total] = await Promise.all([
      db.directory.findMany({
        where,
        select: { id: true, name: true, description: true, category: true, type: true, phone: true, website: true, memberCount: true, isVerified: true, isFeatured: true, viewsCount: true, createdAt: true, district: { select: { id: true, name: true, nameHi: true } }, city: { select: { id: true, name: true, nameHi: true } } },
        orderBy: isFeatured ? [{ isFeatured: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
        skip, take: limit,
      }),
      db.directory.count({ where }),
    ])

    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[DIRECTORY GET] Error:', err)
    return error('Failed to fetch directories')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { name, description, category, type, address, districtId, cityId, phone, email, website, memberCount } = body
    if (!name) return error('Organization name is required')

    const { ipAddress, userAgent } = getClientInfo(request)
    const dir = await db.directory.create({
      data: { ownerId: auth.userId, name, description, category, type, address, districtId, cityId, phone, email, website, memberCount },
    })

    await logAudit({ userId: auth.userId, action: 'directory.create', entity: 'Directory', entityId: dir.id, details: { name }, ipAddress, userAgent })
    return success({ directory: dir }, 201)
  } catch (err) {
    console.error('[DIRECTORY POST] Error:', err)
    return serverError('Failed to create directory listing')
  }
}
