import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { validateMediaFile, MEDIA_CATEGORIES } from '@/services/media'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * POST /api/v1/media/upload — Upload a file (auth required)
 * Accepts multipart/form-data with:
 *   - file: the file blob
 *   - category: PROFILE | BUSINESS | ADVERTISEMENT | DOCUMENT | GENERAL
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

    if (!file) return error('No file provided')

    // Validate category
    if (!MEDIA_CATEGORIES.includes(category as any)) {
      return error(`Invalid category. Must be one of: ${MEDIA_CATEGORIES.join(', ')}`)
    }

    // Validate file
    const validation = validateMediaFile(
      { name: file.name, type: file.type, size: file.size },
      category
    )
    if (!validation.valid) return error(validation.error!)

    // Check membership photo limits
    const existingMediaCount = await db.media.count({
      where: { userId: auth.userId, category },
    })
    const maxPhotos = auth.user.membershipTier === 'ELITE' ? 50
      : auth.user.membershipTier === 'PREMIUM' ? 10 : 3
    if (category === 'PROFILE' && existingMediaCount >= maxPhotos) {
      return error(`Photo limit reached (${maxPhotos} for ${auth.user.membershipTier}). Upgrade for more.`, 403)
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Generate safe filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const safeName = `${randomUUID()}.${ext}`

    // Save to local storage (production: S3/GCS + CDN)
    const uploadDir = join(process.cwd(), 'upload', category.toLowerCase())
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })
    const filePath = join(uploadDir, safeName)
    writeFileSync(filePath, buffer)

    const url = `/upload/${category.toLowerCase()}/${safeName}`
    const isImage = file.type.startsWith('image/')

    // Create media record
    const media = await db.media.create({
      data: {
        userId: auth.userId,
        category,
        type: isImage ? 'IMAGE' : 'DOCUMENT',
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        url,
        isPublic: category !== 'DOCUMENT',
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
