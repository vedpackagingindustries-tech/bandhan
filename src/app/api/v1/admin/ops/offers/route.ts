import { db } from '@/lib/db'
import { success, error, serverError } from '@/lib/api-response'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'
import { logAudit } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const applicableTo = searchParams.get('applicableTo') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (applicableTo) where.applicableTo = applicableTo

    // Auto-expire offers past endDate
    await db.offer.updateMany({
      where: { endDate: { lt: new Date() }, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    })

    const [offers, total] = await Promise.all([
      db.offer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.offer.count({ where }),
    ])

    return success({
      offers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total },
    })
  } catch (err) {
    console.error('[OFFERS LIST] Error:', err)
    return serverError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const body = await request.json()
    const { name, nameHi, description, descriptionHi, discountType, discountValue, applicableTo, applicableTier, promoCode, maxUses, minAmount, startDate, endDate } = body

    if (!name || !discountType) {
      return error('Name and discount type are required')
    }
    if (discountType !== 'FREE_TRIAL' && (!discountValue || discountValue <= 0)) {
      return error('Discount value must be greater than 0')
    }
    if (promoCode) {
      const existing = await db.offer.findUnique({ where: { promoCode } })
      if (existing) return error('Promo code already exists')
    }

    const offer = await db.offer.create({
      data: {
        name, nameHi: nameHi || null, description: description || null, descriptionHi: descriptionHi || null,
        discountType: discountType || 'PERCENTAGE',
        discountValue: discountType === 'FREE_TRIAL' ? 0 : parseFloat(discountValue) || 0,
        applicableTo: applicableTo || 'ALL', applicableTier: applicableTier || 'ALL',
        promoCode: promoCode || null, maxUses: parseInt(maxUses) || 0,
        minAmount: minAmount ? parseFloat(minAmount) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdBy: result.auth?.user?.id,
      },
    })

    await logAudit({
      userId: result.auth?.user?.id, action: 'admin.offer_create', entity: 'Offer', entityId: offer.id,
      details: { name, discountType }
    })

    return success({ offer }, 201)
  } catch (err) {
    console.error('[OFFER CREATE] Error:', err)
    if ((err as { code?: string }).code === 'P2002') return error('Promo code already exists')
    return serverError()
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const body = await request.json()
    const { id, ...data } = body
    if (!id) return error('Offer ID is required')

    const existing = await db.offer.findUnique({ where: { id } })
    if (!existing) return error('Offer not found', 404)

    const updateData: Record<string, unknown> = {}
    const allowed = ['name', 'nameHi', 'description', 'descriptionHi', 'discountType', 'discountValue', 'applicableTo', 'applicableTier', 'promoCode', 'maxUses', 'minAmount', 'startDate', 'endDate', 'status']
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (key === 'startDate' || key === 'endDate') {
          updateData[key] = data[key] ? new Date(data[key]) : null
        } else if (key === 'discountValue' || key === 'maxUses' || key === 'minAmount') {
          updateData[key] = data[key] !== null ? parseFloat(data[key]) : null
        } else {
          updateData[key] = data[key]
        }
      }
    }

    const offer = await db.offer.update({ where: { id }, data: updateData })

    await logAudit({
      userId: result.auth?.user?.id, action: 'admin.offer_update', entity: 'Offer', entityId: id,
      details: updateData
    })

    return success({ offer })
  } catch (err) {
    console.error('[OFFER UPDATE] Error:', err)
    if ((err as { code?: string }).code === 'P2002') return error('Promo code already exists')
    return serverError()
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return error('Offer ID is required')

    await db.offer.delete({ where: { id } })

    await logAudit({
      userId: result.auth?.user?.id, action: 'admin.offer_delete', entity: 'Offer', entityId: id
    })

    return success({ deleted: true })
  } catch (err) {
    console.error('[OFFER DELETE] Error:', err)
    return serverError()
  }
}
