import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

const VALID_MODULES = ['MATRIMONY', 'BUSINESS', 'JOBS', 'DIRECTORY', 'GENERAL']
const VALID_PLACEMENTS = ['HERO', 'MIDDLE', 'BOTTOM']
const VALID_MEDIA_TYPES = ['IMAGE', 'VIDEO', 'LOTTIE']
const VALID_DEVICES = ['ALL', 'MOBILE', 'DESKTOP']
const VALID_LANGUAGES = ['ALL', 'EN', 'HI']
const VALID_STATUSES = ['ACTIVE', 'PAUSED', 'EXPIRED']

// ═══════════════════════════════════════════════════════════
// GET — List ad campaigns with analytics
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const status = sp.get('status')
    const module_ = sp.get('module')
    const placement = sp.get('placement')
    const device = sp.get('device')
    const language = sp.get('language')

    const where: Record<string, unknown> = {}

    if (status && VALID_STATUSES.includes(status)) where.status = status
    if (module_ && VALID_MODULES.includes(module_)) where.module = module_
    if (placement && VALID_PLACEMENTS.includes(placement)) where.placement = placement
    if (device && VALID_DEVICES.includes(device)) where.device = device
    if (language && VALID_LANGUAGES.includes(language)) where.language = language

    const [campaigns, total] = await Promise.all([
      db.adCampaign.findMany({
        where,
        include: {
          _count: {
            select: {
              impressionRecords: true,
              clickRecords: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.adCampaign.count({ where }),
    ])

    const data = campaigns.map((c) => {
      const impressions = c._count.impressionRecords
      const clicks = c._count.clickRecords
      return {
        id: c.id,
        name: c.name,
        module: c.module,
        placement: c.placement,
        mediaType: c.mediaType,
        mediaUrl: c.mediaUrl,
        mobileMediaUrl: c.mobileMediaUrl,
        linkUrl: c.linkUrl,
        ctaText: c.ctaText,
        ctaTextHi: c.ctaTextHi,
        language: c.language,
        device: c.device,
        priority: c.priority,
        impressions,
        clicks,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 100 * 100) / 100 : 0,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        createdBy: c.createdBy,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }
    })

    return success({ campaigns: data, pagination: paginate(page, limit, total) })
  } catch (err) {
    console.error('[AD_CAMPAIGNS_LIST]', err)
    return serverError()
  }
}

// ═══════════════════════════════════════════════════════════
// POST — Create ad campaign
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const body = await request.json()
    const { name, module, placement, mediaType, mediaUrl, mobileMediaUrl, linkUrl, ctaText, ctaTextHi, language, device, priority, startDate, endDate } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return error('name is required')
    }
    if (!module || !VALID_MODULES.includes(module)) {
      return error(`module must be one of: ${VALID_MODULES.join(', ')}`)
    }
    if (!placement || !VALID_PLACEMENTS.includes(placement)) {
      return error(`placement must be one of: ${VALID_PLACEMENTS.join(', ')}`)
    }
    if (!mediaType || !VALID_MEDIA_TYPES.includes(mediaType)) {
      return error(`mediaType must be one of: ${VALID_MEDIA_TYPES.join(', ')}`)
    }
    if (!mediaUrl || typeof mediaUrl !== 'string' || mediaUrl.trim().length === 0) {
      return error('mediaUrl is required')
    }

    // Validate optional enums
    if (device && !VALID_DEVICES.includes(device)) {
      return error(`device must be one of: ${VALID_DEVICES.join(', ')}`)
    }
    if (language && !VALID_LANGUAGES.includes(language)) {
      return error(`language must be one of: ${VALID_LANGUAGES.join(', ')}`)
    }

    const campaign = await db.adCampaign.create({
      data: {
        name: name.trim(),
        module,
        placement,
        mediaType,
        mediaUrl: mediaUrl.trim(),
        mobileMediaUrl: mobileMediaUrl?.trim() || null,
        linkUrl: linkUrl?.trim() || null,
        ctaText: ctaText?.trim() || null,
        ctaTextHi: ctaTextHi?.trim() || null,
        language: language || 'ALL',
        device: device || 'ALL',
        priority: typeof priority === 'number' ? priority : 0,
        status: 'ACTIVE',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdBy: auth.user.id,
      },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.user.id,
      action: 'admin.ad_create',
      entity: 'AdCampaign',
      entityId: campaign.id,
      details: { name: campaign.name, module, placement },
      ipAddress,
      userAgent,
    })

    return success({ campaign }, 201)
  } catch (err) {
    console.error('[AD_CAMPAIGN_CREATE]', err)
    return serverError()
  }
}
