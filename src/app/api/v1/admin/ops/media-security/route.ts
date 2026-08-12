import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { moderateImage } from '@/services/ai'
import { NextRequest } from 'next/server'

const VALID_CATEGORIES = ['PROFILE', 'BUSINESS', 'ADVERTISEMENT', 'DOCUMENT', 'GENERAL']
const VALID_ACTIONS = ['HIDE', 'DELETE', 'REQUEST_MODERATION']

// ═══════════════════════════════════════════════════════════
// GET — Media audit report with moderation status
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp, { page: 1, limit: 20 })

    const category = sp.get('category')
    const aiModerated = sp.get('aiModerated')

    // Build where clause
    const where: Record<string, unknown> = {}
    if (category && VALID_CATEGORIES.includes(category)) where.category = category
    if (aiModerated !== null && aiModerated !== undefined && aiModerated !== '') {
      where.aiModerated = aiModerated === 'true'
    }

    // Fetch media with user info and moderation results
    const [mediaRecords, total, statsTotal, statsModerated, statsUnmoderated, categoryBreakdown] = await Promise.all([
      db.media.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.media.count({ where }),
      db.media.count({}),
      db.media.count({ where: { aiModerated: true } }),
      db.media.count({ where: { aiModerated: false } }),
      db.media.groupBy({
        by: ['category'],
        _count: { category: true },
      }),
    ])

    // Fetch moderation results for the returned media IDs in a single query
    const mediaIds = mediaRecords.map((m) => m.id)
    const moderationResults = mediaIds.length > 0
      ? await db.moderationResult.findMany({
          where: { mediaId: { in: mediaIds } },
        })
      : []

    // Build a lookup map for moderation results
    const moderationMap = new Map(moderationResults.map((mr) => [mr.mediaId, mr]))

    // Build category stats map
    const byCategory: Record<string, number> = {}
    for (const cb of categoryBreakdown) {
      byCategory[cb.category] = cb._count.category
    }

    const data = mediaRecords.map((media) => {
      const moderation = moderationMap.get(media.id)
      return {
        id: media.id,
        userId: media.userId,
        userName: media.user?.profile?.displayName ?? media.user?.email ?? null,
        category: media.category,
        type: media.type,
        fileName: media.fileName,
        fileSize: media.fileSize,
        mimeType: media.mimeType,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        isPublic: media.isPublic,
        aiModerated: media.aiModerated,
        moderation: moderation
          ? {
              verdict: moderation.verdict,
              confidence: moderation.confidence,
              flags: moderation.flags,
              autoAction: moderation.autoAction,
              reviewedBy: moderation.reviewedBy,
              reviewedAt: moderation.reviewedAt,
              reviewOutcome: moderation.reviewOutcome,
            }
          : null,
        createdAt: media.createdAt.toISOString(),
        updatedAt: media.updatedAt.toISOString(),
      }
    })

    return success({
      media: data,
      pagination: paginate(page, limit, total),
      stats: {
        total: statsTotal,
        moderated: statsModerated,
        unmoderated: statsUnmoderated,
        byCategory,
      },
    })
  } catch (err) {
    console.error('[MEDIA_SECURITY] GET error:', err)
    return serverError('Failed to retrieve media security report')
  }
}

// ═══════════════════════════════════════════════════════════
// POST — Bulk media action (HIDE / DELETE / REQUEST_MODERATION)
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const body = await request.json()
    const { action, mediaIds, reason } = body as {
      action?: string
      mediaIds?: string[]
      reason?: string
    }

    // Validate action
    if (!action || !VALID_ACTIONS.includes(action)) {
      return error(`action must be one of: ${VALID_ACTIONS.join(', ')}`)
    }

    // Validate mediaIds
    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return error('mediaIds must be a non-empty array')
    }
    if (mediaIds.length > 100) {
      return error('Cannot process more than 100 media items at once')
    }

    const { ipAddress, userAgent } = getClientInfo(request)

    // Verify all media IDs exist
    const existingMedia = await db.media.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true, type: true, url: true },
    })
    const existingIds = new Set(existingMedia.map((m) => m.id))
    const invalidIds = mediaIds.filter((id) => !existingIds.has(id))

    if (invalidIds.length > 0) {
      return error(`Invalid media IDs: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''}`)
    }

    let result: Record<string, unknown> = {}

    switch (action) {
      case 'HIDE': {
        const updateResult = await db.media.updateMany({
          where: { id: { in: mediaIds } },
          data: { isPublic: false },
        })
        result = { hidden: updateResult.count }
        break
      }

      case 'DELETE': {
        // Hard delete — in production, would move to cold storage first
        const deleteResult = await db.media.deleteMany({
          where: { id: { in: mediaIds } },
        })
        result = { deleted: deleteResult.count }
        break
      }

      case 'REQUEST_MODERATION': {
        // Run AI moderation on each IMAGE media that has a URL
        const imageMedia = existingMedia.filter((m) => m.type === 'IMAGE' && m.url)
        const moderationOutcomes: Array<{
          mediaId: string
          verdict: string
          confidence: number
          flags: string[]
          autoAction: string
          error?: string
        }> = []

        for (const media of imageMedia) {
          try {
            const modResult = await moderateImage({
              mediaId: media.id,
              imageUrl: media.url,
              userId: auth.user.id,
            })
            moderationOutcomes.push({
              mediaId: media.id,
              verdict: modResult.verdict,
              confidence: modResult.confidence,
              flags: modResult.flags.map((f) => f.category),
              autoAction: modResult.autoAction,
            })
          } catch (modErr) {
            moderationOutcomes.push({
              mediaId: media.id,
              verdict: 'REVIEW',
              confidence: 0,
              flags: ['moderation_failed'],
              autoAction: 'FLAG_FOR_REVIEW',
              error: modErr instanceof Error ? modErr.message : 'Unknown error',
            })
          }
        }

        result = {
          processed: imageMedia.length,
          skipped: existingMedia.length - imageMedia.length,
          outcomes: moderationOutcomes,
        }
        break
      }
    }

    // Audit log
    await logAudit({
      userId: auth.user.id,
      action: `admin.media_bulk_${action.toLowerCase()}`,
      entity: 'Media',
      details: {
        action,
        mediaCount: mediaIds.length,
        reason: reason || null,
        result,
      },
      ipAddress,
      userAgent,
    })

    return success({ action, mediaCount: mediaIds.length, ...result })
  } catch (err) {
    console.error('[MEDIA_SECURITY] POST error:', err)
    return serverError('Failed to process media action')
  }
}
