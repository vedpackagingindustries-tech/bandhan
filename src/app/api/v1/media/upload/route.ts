// ═══════════════════════════════════════════════════════════
// MEDIA UPLOAD API
// POST: Upload file to Vercel Blob (cloud) with validation
// GET: List user's media files
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { success, error, unauthorized } from '@/lib/api-response'
import { validateMediaFile, uploadFile, createMediaRecord, getUserMedia } from '@/services/media'
import { logAudit } from '@/lib/audit'

// Extract user from Bearer token
async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const session = await db.userSession.findUnique({
    where: { token },
    include: { user: { include: { role: true } } },
  })
  if (!session || session.expiresAt < new Date()) return null
  if (session.user.status !== 'ACTIVE') return null
  return session.user
}

// POST: Upload file
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) return unauthorized('Invalid or expired session')

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const category = (formData.get('category') as string) || 'GENERAL'

    if (!file) {
      return error('No file provided')
    }

    // Validate file
    const validation = validateMediaFile(
      { name: file.name, type: file.type, size: file.size },
      category
    )
    if (!validation.valid) {
      return error(validation.error || 'Invalid file')
    }

    // Membership-based photo limits
    const existingMedia = await db.media.count({
      where: { userId: user.id, category },
    })

    const limits: Record<string, number> = {
      FREE: 5,
      PREMIUM: 20,
      ELITE: 50,
    }
    const maxPhotos = limits[user.membershipTier] || 5

    if (category === 'PROFILE' && existingMedia >= maxPhotos) {
      return error(`Photo limit reached (${maxPhotos} for ${user.membershipTier} tier). Upgrade membership for more.`)
    }

    // Read file data
    const arrayBuffer = await file.arrayBuffer()

    // Upload to cloud storage
    const { url, thumbnailUrl } = await uploadFile(
      { name: file.name, type: file.type, size: file.size, data: arrayBuffer },
      category,
      user.id
    )

    // Create media record
    const result = await createMediaRecord({
      userId: user.id,
      category,
      type: file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      url,
      thumbnailUrl,
      isPublic: category === 'PROFILE',
    })

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'media.upload',
      entity: 'Media',
      entityId: result.mediaId,
      details: { fileName: file.name, category, fileSize: file.size },
    })

    return success(result)
  } catch (err) {
    console.error('[MEDIA UPLOAD] Error:', err)
    return error('Upload failed')
  }
}

// GET: List user's media
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) return unauthorized('Invalid or expired session')

    const url = new URL(request.url)
    const category = url.searchParams.get('category') || undefined

    const media = await getUserMedia(user.id, category)
    return success({ items: media, count: media.length })
  } catch (err) {
    console.error('[MEDIA LIST] Error:', err)
    return error('Failed to fetch media')
  }
}
