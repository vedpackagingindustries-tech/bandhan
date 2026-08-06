import { db } from '@/lib/db'
import { unauthorized, success, error, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams, { page: 1, limit: 20 })
    const status = searchParams.get('status')
    const position = searchParams.get('position')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (position) where.position = position

    const [ads, total] = await Promise.all([
      db.advertisement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.advertisement.count({ where }),
    ])

    // Summary stats
    const [totalAds, activeAds, totalImpressions, totalClicks] = await Promise.all([
      db.advertisement.count(),
      db.advertisement.count({ where: { status: 'ACTIVE' } }),
      db.advertisement.aggregate({ _sum: { impressions: true } }),
      db.advertisement.aggregate({ _sum: { clicks: true } }),
    ])

    return success({
      advertisements: ads,
      summary: {
        total: totalAds,
        active: activeAds,
        totalImpressions: totalImpressions._sum.impressions || 0,
        totalClicks: totalClicks._sum.clicks || 0,
      },
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[ADVERTISEMENTS] Error:', err)
    return error('Failed to fetch advertisements')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { title, description, imageUrl, linkUrl, position, category, startDate, endDate } = body

    if (!title || !position) return error('Title and position are required')

    const validPositions = ['HERO', 'MIDDLE', 'BOTTOM', 'SIDEBAR']
    if (!validPositions.includes(position)) return error('Invalid position')

    const validCategories = ['MATRIMONY', 'BUSINESS', 'JOBS', 'DIRECTORY', 'GENERAL']
    if (category && !validCategories.includes(category)) return error('Invalid category')

    const ad = await db.advertisement.create({
      data: {
        userId: auth.userId,
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        position,
        category: category || 'GENERAL',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'admin.advertisement_create',
      entity: 'Advertisement',
      entityId: ad.id,
      details: { title, position, category },
      ipAddress,
      userAgent,
    })

    return success({ advertisement: ad }, 201)
  } catch (err) {
    console.error('[AD CREATE] Error:', err)
    return error('Failed to create advertisement')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { adId, status, title, description, imageUrl, linkUrl, startDate, endDate } = body

    if (!adId) return error('Advertisement ID is required')

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (title) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl
    if (linkUrl !== undefined) updateData.linkUrl = linkUrl
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null

    const ad = await db.advertisement.update({
      where: { id: adId },
      data: updateData,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'admin.advertisement_update',
      entity: 'Advertisement',
      entityId: adId,
      details: { updatedFields: Object.keys(updateData) },
      ipAddress,
      userAgent,
    })

    return success({ advertisement: ad })
  } catch (err) {
    console.error('[AD UPDATE] Error:', err)
    return error('Failed to update advertisement')
  }
}
