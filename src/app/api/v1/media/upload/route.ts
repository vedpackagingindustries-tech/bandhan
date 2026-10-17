import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { validateMediaFile, MEDIA_CATEGORIES } from '@/services/media'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

/**
 * POST /api/v1/media/upload — Upload a file (auth required)
 * Uses Vercel Blob in production, local filesystem in development
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    if (auth.user.status !== 'ACTIVE') return error('Account not active', 403)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const category = (formData.get('category') as string) || 'GENERAL'
    const isPublic = formData.get('isPublic') !== 'false'

    if (!file) return error('No file provided')

    if (!MEDIA_CATEGORIES.includes(category as any)) {
      return error(`Invalid category. Must be one of: ${MEDIA_CATEGORIES.join(', ')}`)
    }

    const validation = validateMediaFile(
      { name: file.name, type: file.type, size: file.size },
      category
    )
    if (!validation.valid) return error(validation.error!)

    const existingMediaCount = await db.media.count({
      where: { userId: auth.userId, category },
    })
    const maxPhotos = auth.user.membershipTier === 'ELITE' ? 50
      : auth.user.membershipTier === 'PREMIUM' ? 10 : 3
    if (category === 'PROFILE' && existingMediaCount >= maxPhotos) {
      return error(`Photo limit reached (${maxPhotos} for ${auth.user.membershipTier}). Upgrade for more.`, 403)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const isImage = file.type.startsWith('image/')
    let url: string

    // Try Vercel Blob first (production)
    try {
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob')
        const safeName = `${category.toLowerCase()}/${auth.userId}/${randomUUID()}-${file.name}`
        const blob = await put(safeName, buffer, {
          access: isPublic ? 'public' : 'private',
          contentType: file.type,
        })
        url = blob.url
      } else {
        throw new Error('Blob not configured')
      }
    } catch {
      // Fallback: local filesystem
      const { writeFileSync, mkdirSync, existsSync } = await import('fs')
      const { join } = await import('path')
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const safeName = `${randomUUID()}.${ext}`
      const uploadDir = join(process.cwd(), 'upload', category.toLowerCase())
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })
      writeFileSync(join(uploadDir, safeName), buffer)
      url = `/upload/${category.toLowerCase()}/${safeName}`
    }

    const media = await db.media.create({
      data: {
        userId: auth.userId,
        category,
        type: isImage ? 'IMAGE' : 'DOCUMENT',
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        url,
        isPublic,
      },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'media.upload',
      entity: 'Media',
      entityId: media.id,
      details: { fileName: file.name, category, fileSize: file.size },
      ipAddress,
      userAgent,
    })

    return success({
      media: {
        id: media.id,
        url: media.url,
        fileName: media.fileName,
        fileSize: media.fileSize,
        type: media.type,
        category: media.category,
      },
    }, 201)
  } catch (err) {
    console.error('[MEDIA UPLOAD] Error:', err)
    return error('Failed to upload file', 500)
  }
}
