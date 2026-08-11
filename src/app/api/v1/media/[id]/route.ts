import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { deleteMedia } from '@/services/media'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const { id } = await params
    const media = await db.media.findFirst({ where: { id } })
    if (!media) return error('Media not found', 404)

    // Users can only view their own media, or any public media
    if (media.userId !== auth.userId && !media.isPublic) {
      return error('Access denied', 403)
    }

    return success({ media })
  } catch (err) {
    console.error('[MEDIA GET] Error:', err)
    return serverError('Failed to fetch media')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const { id } = await params
    const { ipAddress, userAgent } = getClientInfo(request)

    const deleted = await deleteMedia(id, auth.userId, ipAddress, userAgent)
    if (!deleted) return error('Media not found or not owned by you', 404)

    return success({ deleted: true })
  } catch (err) {
    console.error('[MEDIA DELETE] Error:', err)
    return serverError('Failed to delete media')
  }
}
