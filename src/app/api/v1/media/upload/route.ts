// ═══════════════════════════════════════════════════════════
// MEDIA UPLOAD API
// Supports @vercel/blob (cloud) with local filesystem fallback
// Validates file type, size, and membership photo limits
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { success, error, unauthorized, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'
import { sanitizeString } from '@/lib/validation'

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/svg+xml', 'video/mp4', 'video/webm',
  'application/pdf',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_PHOTOS_PER_USER = 12

// Membership photo limits
const MEMBERSHIP_PHOTO_LIMITS: Record<string, number> = {
  FREE_USER: 4,
  PREMIUM_USER: 8,
  ELITE_USER: 12,
}

/** Upload to @vercel/blob if configured, else return null */
async function uploadToBlob(fileBuffer: Buffer, filename: string, contentType: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const { put } = await import('@vercel/blob')
    const result = await put(filename, fileBuffer, {
      contentType,
      access: 'public',
    })
    return result.url
  } catch (err) {
    console.warn('[MEDIA] Blob upload failed:', err)
    return null
  }
}

export async function POST(request: NextRequest) {
  // ─── Auth check ───
  const authResult = await requireAuth(request)
  if ('error' in authResult) return authResult.error
  const session = authResult.auth
  const userId = session.user.id
  const roleName = session.user.role?.name || 'FREE_USER'

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const category = formData.get('category') as string || 'GENERAL'
    const alt = formData.get('alt') as string | null

    if (!file) {
      return error('No file provided. Use multipart form-data with "file" field.', 400)
    }

    // ─── Validate MIME type ───
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return error(
        `File type "${file.type}" not allowed. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
        400
      )
    }

    // ─── Validate file size ───
    if (file.size > MAX_FILE_SIZE) {
      return error(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400)
    }

    // ─── Check photo limit ───
    if (category === 'PROFILE') {
      const currentCount = await db.media.count({
        where: { userId, category: 'PROFILE' },
      })
      const limit = MEMBERSHIP_PHOTO_LIMITS[roleName] || MAX_PHOTOS_PER_USER
      if (currentCount >= limit) {
        return error(
          `Photo limit reached (${limit} for ${roleName}). Upgrade membership for more.`,
          403
        )
      }
    }

    // ─── Generate safe filename ───
    const ext = file.name.split('.').pop() || 'bin'
    const safeName = `${randomUUID()}.${ext}`

    // ─── Read file bytes ───
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // ─── Upload: Try @vercel/blob first, then local fallback ───
    let url: string

    const blobUrl = await uploadToBlob(fileBuffer, safeName, file.type)
    if (blobUrl) {
      url = blobUrl
    } else {
      // Local filesystem fallback (dev / no blob configured)
      const fs = await import('fs/promises')
      const path = await import('path')
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      try {
        await fs.mkdir(uploadDir, { recursive: true })
      } catch { /* dir exists */ }
      await fs.writeFile(path.join(uploadDir, safeName), fileBuffer)
      url = `/uploads/${safeName}`
    }

    // ─── Determine media type ───
    const mediaType = file.type.startsWith('image/') ? 'IMAGE'
      : file.type.startsWith('video/') ? 'VIDEO'
      : 'DOCUMENT'

    // ─── Save to database ───
    const media = await db.media.create({
      data: {
        userId,
        category: sanitizeString(category),
        type: mediaType,
        fileName: safeName,
        fileSize: file.size,
        mimeType: file.type,
        url,
        alt: alt ? sanitizeString(alt) : null,
        isPublic: category !== 'DOCUMENT',
      },
    })

    // ─── Audit log ───
    try {
      await db.auditLog.create({
        data: {
          userId,
          action: 'MEDIA_UPLOAD',
          entity: 'Media',
          entityId: media.id,
          details: JSON.stringify({
            fileName: safeName,
            fileSize: file.size,
            mimeType: file.type,
            category,
            storage: blobUrl ? 'blob' : 'local',
          }),
        },
      })
    } catch { /* audit log failure is non-critical */ }

    return success({ media }, 201)
  } catch (err) {
    console.error('[MEDIA] Upload error:', err)
    return serverError('Upload failed')
  }
}

/** GET - List user's media */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if ('error' in authResult) return authResult.error
  const userId = authResult.auth.user.id

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  const where: Record<string, unknown> = { userId }
  if (category) where.category = category

  const items = await db.media.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return success({ items })
}

/** DELETE - Remove media */
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request)
  if ('error' in authResult) return authResult.error
  const userId = authResult.auth.user.id

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return error('Media ID required (?id=...)', 400)

  const media = await db.media.findUnique({ where: { id } })
  if (!media) return error('Media not found', 404)
  if (media.userId !== userId) return unauthorized()

  // Delete from blob if applicable
  if (media.url.includes('blob.vercel-storage.com') && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import('@vercel/blob')
      await del(media.url)
    } catch { /* best effort */ }
  }

  await db.media.delete({ where: { id } })

  return success({ deleted: true })
}
