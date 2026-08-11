import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/** GET /api/v1/business — List ACTIVE businesses with filters */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const districtId = searchParams.get('districtId')
    const cityId = searchParams.get('cityId')
    const isVerified = searchParams.get('verified') === 'true'
    const search = searchParams.get('search')
    const isFeatured = searchParams.get('featured') === 'true'
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = { status: 'ACTIVE' }
    if (category) where.category = category
    if (districtId) where.districtId = districtId
    if (cityId) where.cityId = cityId
    if (isVerified) where.isVerified = true
    if (isFeatured) where.isFeatured = true
    if (search) where.name = { contains: search }

    const [items, total] = await Promise.all([
      db.business.findMany({
        where,
        select: {
          id: true, name: true, description: true, category: true, type: true,
          address: true, phone: true, website: true, isVerified: true, isFeatured: true,
          viewsCount: true, createdAt: true,
          district: { select: { id: true, name: true, nameHi: true } },
          city: { select: { id: true, name: true, nameHi: true } },
        },
        orderBy: isFeatured ? [{ isFeatured: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
        skip, take: limit,
      }),
      db.business.count({ where }),
    ])

    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[BUSINESS GET] Error:', err)
    return error('Failed to fetch businesses')
  }
}

/** POST /api/v1/business — Create business listing */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { name, description, category, services, type, address, districtId, cityId,
      phone, email, website, gstNumber, workingHours, foundedYear, employeeCount } = body
    if (!name) return error('Business name is required')

    const { ipAddress, userAgent } = getClientInfo(request)
    const business = await db.business.create({
      data: {
        ownerId: auth.userId, name, description, category, type: type || 'SOLE_PROPRIETORSHIP',
        address, districtId, cityId, phone, email, website, gstNumber,
        services: services ? JSON.stringify(services) : undefined,
        workingHours: workingHours ? JSON.stringify(workingHours) : undefined,
        foundedYear, employeeCount,
      },
    })

    await logAudit({ userId: auth.userId, action: 'business.create', entity: 'Business', entityId: business.id, details: { name }, ipAddress, userAgent })
    return success({ business }, 201)
  } catch (err) {
    console.error('[BUSINESS POST] Error:', err)
    return serverError('Failed to create business')
  }
}
