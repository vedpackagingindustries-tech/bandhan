import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

const VALID_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['PAUSED', 'EXPIRED'],
  PAUSED: ['ACTIVE'],
}

// ═══════════════════════════════════════════════════════════
// GET — Campaign details with recent impressions/clicks
// ═══════════════════════════════════════════════════════════
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const { id } = await params

    const campaign = await db.adCampaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            impressionRecords: true,
            clickRecords: true,
          },
        },
      },
    })

    if (!campaign) return error('Campaign not found', 404)

    const impressions = campaign._count.impressionRecords
    const clicks = campaign._count.clickRecords

    // Get last 100 impressions
    const recentImpressions = await db.adImpression.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        device: true,
        module: true,
        placement: true,
        language: true,
        createdAt: true,
      },
    })

    // Get last 100 clicks
    const recentClicks = await db.adClick.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        device: true,
        module: true,
        placement: true,
        language: true,
        createdAt: true,
      },
    })

    return success({
      campaign: {
        ...campaign,
        impressions,
        clicks,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 100 * 100) / 100 : 0,
      },
      recentImpressions,
      recentClicks,
    })
  } catch (err) {
    console.error('[AD_CAMPAIGN_DETAIL]', err)
    return serverError()
  }
}

// ═══════════════════════════════════════════════════════════
// PUT — Update campaign
// ═══════════════════════════════════════════════════════════
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const { id } = await params
    const body = await request.json()

    const existing = await db.adCampaign.findUnique({ where: { id } })
    if (!existing) return error('Campaign not found', 404)

    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'name', 'module', 'placement', 'mediaType', 'mediaUrl',
      'mobileMediaUrl', 'linkUrl', 'ctaText', 'ctaTextHi',
      'language', 'device', 'priority', 'startDate', 'endDate',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'name' && (typeof body[field] !== 'string' || body[field].trim().length === 0)) {
          return error('name cannot be empty')
        }
        if (field === 'mediaUrl' && (typeof body[field] !== 'string' || body[field].trim().length === 0)) {
          return error('mediaUrl cannot be empty')
        }
        if (['startDate', 'endDate'].includes(field) && body[field] !== null) {
          updateData[field] = new Date(body[field])
        } else if (field === 'priority') {
          updateData[field] = typeof body[field] === 'number' ? body[field] : 0
        } else {
          updateData[field] = body[field]
        }
      }
    }

    // Handle status transitions
    if (body.status !== undefined) {
      const allowed = VALID_TRANSITIONS[existing.status]
      if (!allowed || !allowed.includes(body.status)) {
        return error(`Invalid transition: ${existing.status} -> ${body.status}. Allowed: ${allowed?.join(', ') || 'none'}`)
      }
      updateData.status = body.status
    }

    const campaign = await db.adCampaign.update({
      where: { id },
      data: updateData,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.user.id,
      action: 'admin.ad_update',
      entity: 'AdCampaign',
      entityId: id,
      details: { changedFields: Object.keys(updateData) },
      ipAddress,
      userAgent,
    })

    return success({ campaign })
  } catch (err) {
    console.error('[AD_CAMPAIGN_UPDATE]', err)
    return serverError()
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE — Hard delete campaign (cascade cleans impressions/clicks)
// ═══════════════════════════════════════════════════════════
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const { id } = await params

    const existing = await db.adCampaign.findUnique({ where: { id } })
    if (!existing) return error('Campaign not found', 404)

    await db.adCampaign.delete({ where: { id } })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.user.id,
      action: 'admin.ad_delete',
      entity: 'AdCampaign',
      entityId: id,
      details: { name: existing.name, module: existing.module },
      ipAddress,
      userAgent,
    })

    return success({ deleted: true })
  } catch (err) {
    console.error('[AD_CAMPAIGN_DELETE]', err)
    return serverError()
  }
}
