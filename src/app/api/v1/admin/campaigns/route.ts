import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { searchParams } = new URL(request.url)
    const mod = searchParams.get('module')
    const status = searchParams.get('status')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = {}
    if (mod) where.module = mod
    if (status) where.status = status

    const [items, total] = await Promise.all([
      db.adCampaign.findMany({ where, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], skip, take: limit }),
      db.adCampaign.count({ where }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[ADMIN CAMPAIGNS] Error:', err)
    return error('Failed to fetch campaigns')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const body = await request.json()
    const { name, module: mod2, placement, mediaType, mediaUrl, mobileMediaUrl, linkUrl, ctaText, ctaTextHi, language, device, priority, startDate, endDate } = body

    if (!name || !mod2 || !placement || !mediaUrl) return error('name, module, placement, and mediaUrl are required')
    const VALID_PLACEMENTS = ['HERO', 'MIDDLE', 'BOTTOM']
    if (!VALID_PLACEMENTS.includes(placement)) return error('Invalid placement. Use HERO, MIDDLE, or BOTTOM.')

    const { ipAddress, userAgent } = getClientInfo(request)
    const campaign = await db.adCampaign.create({
      data: { name, module: mod2, placement, mediaType: mediaType || 'IMAGE', mediaUrl, mobileMediaUrl, linkUrl, ctaText, ctaTextHi, language: language || 'ALL', device: device || 'ALL', priority: priority || 0, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, createdBy: auth.userId },
    })

    await logAudit({ userId: auth.userId, action: 'admin.campaign.create', entity: 'AdCampaign', entityId: campaign.id, details: { name, module: mod2, placement }, ipAddress, userAgent })
    return success({ campaign }, 201)
  } catch (err) {
    console.error('[ADMIN CAMPAIGNS POST] Error:', err)
    return error('Failed to create campaign')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result
    const body = await request.json()
    const { id, status, priority, startDate, endDate } = body
    if (!id) return error('Campaign ID required')

    const data: Record<string, unknown> = {}
    if (status) data.status = status
    if (priority !== undefined) data.priority = priority
    if (startDate) data.startDate = new Date(startDate)
    if (endDate) data.endDate = new Date(endDate)

    const updated = await db.adCampaign.update({ where: { id }, data })
    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({ userId: auth.userId, action: 'admin.campaign.update', entity: 'AdCampaign', entityId: id, details: { status, priority }, ipAddress, userAgent })
    return success({ campaign: updated })
  } catch (err) {
    console.error('[ADMIN CAMPAIGNS PUT] Error:', err)
    return error('Failed to update campaign')
  }
}