import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { validateMediaFile, createMediaRecord, getUserMedia, deleteMedia } from '@/services/media'
import { logAudit } from '@/lib/audit'
import { sanitizeString } from '@/lib/validation'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { fileName, fileSize, mimeType, category, url, alt, isPublic } = body

    if (!fileName || !fileSize || !mimeType || !category || !url) {
      return error('fileName, fileSize, mimeType, category, and url are required')
    }

    const validation = validateMediaFile({ name: fileName, type: mimeType, size: fileSize }, category)
    if (!validation.valid) return error(validation.error!)

    const { ipAddress, userAgent } = getClientInfo(request)

    const media = await createMediaRecord({
      userId: auth.userId,
      category,
      type: mimeType.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
      fileName: sanitizeString(fileName),
      fileSize,
      mimeType,
      url,
      alt: alt ? sanitizeString(alt) : undefined,
      isPublic: isPublic ?? true,
    })

    await logAudit({
      userId: auth.userId,
      action: 'media.upload',
      entity: 'Media',
      entityId: media.mediaId,
      details: { fileName, category, fileSize },
      ipAddress,
      userAgent,
    })

    return success({ media }, 201)
  } catch (err) {
    console.error('[MEDIA UPLOAD] Error:', err)
    return serverError('Media upload failed')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const media = await getUserMedia(result.auth.userId, category || undefined)
    return success({ media })
  } catch (err) {
    console.error('[MEDIA LIST] Error:', err)
    return error('Failed to fetch media')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get('mediaId')
    if (!mediaId) return error('mediaId is required')

    const { ipAddress, userAgent } = getClientInfo(request)
    const deleted = await deleteMedia(mediaId, result.auth.userId, ipAddress, userAgent)

    if (!deleted) return error('Media not found', 404)
    return success({ deleted: true })
  } catch (err) {
    console.error('[MEDIA DELETE] Error:', err)
    return error('Failed to delete media')
  }
}
