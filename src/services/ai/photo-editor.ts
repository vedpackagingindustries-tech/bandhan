// ═══════════════════════════════════════════════════════════
// AI PHOTO EDITOR INTEGRATION
// Provider-independent. Premium/Elite only.
// Original photo is NEVER modified. Each edit = new version.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import type { PhotoEditRequest, PhotoEditResult, PhotoEditOperation } from './types'
import { hasFeature } from '@/services/membership-limits'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

/**
 * Request a photo edit. Validates membership, creates new media version.
 */
export async function editPhoto(params: PhotoEditRequest & { userId: string }): Promise<PhotoEditResult> {
  const startMs = Date.now()


  // Check membership
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { membershipTier: true },
  })
  if (!user) throw new Error('User not found')
  if (!hasFeature(user.membershipTier as 'FREE' | 'PREMIUM' | 'ELITE', 'AI_PHOTO_EDITOR')) {
    return {
      originalMediaId: params.mediaId,
      newMediaId: '',
      operations: params.operations,
      status: 'FAILED',
    }
  }

  // Get original media
  const media = await db.media.findUnique({ where: { id: params.mediaId } })
  if (!media || !media.url) {
    return {
      originalMediaId: params.mediaId,
      newMediaId: '',
      operations: params.operations,
      status: 'FAILED',
    }
  }

  // Use image-editing SDK for actual operations
  try {
    const sdkMod = await import('z-ai-web-dev-sdk')
    const ZAIClass = (sdkMod.default || sdkMod.default) as any
    const sdkInstance = new ZAIClass()
    if (typeof sdkInstance.createImageEdit !== 'function') {
      throw new Error('Photo editing not available in SDK')
    }

    const result = await sdkInstance.createImageEdit({
      image_url: media.url,
      prompt: `Edit this photo: ${params.operations.join(', ')}. Keep the person's identity intact. Do NOT create misleading changes.`,
    })

    const editUrl = (result as any).url || (result as any).image_url || ''

    // Create new media record for the edited version
    const newMedia = await db.media.create({
      data: {
        userId: params.userId,
        category: media.category,
        type: 'IMAGE',
        fileName: `edited_${media.fileName}`,
        fileSize: 0,
        mimeType: media.mimeType,
        url: editUrl,
        alt: `Edited version of ${media.id}. Original: ${media.fileName}. Operations: ${params.operations.join(', ')}`,
        sortOrder: media.sortOrder,
        isPublic: media.isPublic,
      },
    })

    await recordAIUsage({
      operation: 'EDIT', provider: 'ZAI', model: 'photo-editor',
      success: true, latencyMs: Date.now() - startMs,
    })

    return {
      originalMediaId: params.mediaId,
      newMediaId: newMedia.id,
      operations: params.operations,
      status: 'COMPLETED',
    }
  } catch (err) {
    console.error('[PHOTO_EDITOR] Edit failed:', err)
  }

  return {
    originalMediaId: params.mediaId,
    newMediaId: '',
    operations: params.operations,
    status: 'FAILED',
  }
}

/**
 * Get all versions (original + edits) of a media.
 */
export async function getMediaVersions(mediaId: string) {
  const original = await db.media.findUnique({ where: { id: mediaId } })
  if (!original) return []

  const versions = await db.media.findMany({
    where: {
      userId: original.userId,
      category: original.category,
      alt: { contains: mediaId },
    },
    orderBy: { createdAt: 'asc' },
  })

  return [original, ...versions]
}
