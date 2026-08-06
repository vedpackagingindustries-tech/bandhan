import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { validateMediaFile, createMediaRecord, MAX_FILE_SIZES, ALLOWED_IMAGE_TYPES } from '@/services/media'
import { enqueueJob } from '@/services/queue'
import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')
const MAX_FILES_PER_REQUEST = 10

/**
 * POST /api/v1/media/upload
 * Upload one or more files. Supports multipart/form-data.
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const category = (formData.get('category') as string) || 'GENERAL'

    if (!files || files.length === 0) {
      return error('No files provided')
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return error(`Maximum ${MAX_FILES_PER_REQUEST} files per request`)
    }

    // Check user media count limits
    const mediaCount = await db.media.count({ where: { userId: auth.userId } })
    if (mediaCount + files.length > 50) {
      return error('Maximum 50 media files allowed per user')
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    const results = []

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

    for (const file of files) {
      // Validate file
      const validation = validateMediaFile(
        { name: file.name, type: file.type, size: file.size },
        category
      )

      if (!validation.valid) {
        results.push({ fileName: file.name, error: validation.error })
        continue
      }

      // Generate unique filename
      const ext = file.name.split('.').pop() || 'bin'
      const uniqueName = `${randomUUID()}.${ext}`
      const relativePath = `uploads/${category.toLowerCase()}/${uniqueName}`
      const fullPath = join(process.cwd(), 'public', relativePath)

      // Ensure sub-directory exists
      await mkdir(join(UPLOAD_DIR, category.toLowerCase()), { recursive: true })

      // Write file to disk
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(fullPath, buffer)

      // Generate thumbnail URL for images
      let thumbnailUrl: string | undefined
      const url = `/${relativePath}`

      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        thumbnailUrl = `${url}?w=300&h=300&fit=crop`

        // Queue image processing job (resize, compress)
        enqueueJob('IMAGE_PROCESS', {
          mediaPath: fullPath,
          category,
          userId: auth.userId,
        })
      }

      // Create media record
      const mediaResult = await createMediaRecord({
        userId: auth.userId,
        category,
        type: ALLOWED_IMAGE_TYPES.includes(file.type) ? 'IMAGE' : 'DOCUMENT',
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        url,
        thumbnailUrl,
      })

      results.push({
        ...mediaResult,
        originalName: file.name,
      })
    }

    await logAudit({
      userId: auth.userId,
      action: 'media.upload_batch',
      entity: 'Media',
      details: { category, fileCount: files.length, successfulCount: results.filter((r: any) => !r.error).length },
      ipAddress,
      userAgent,
    })

    return success({ files: results }, 201)
  } catch (err) {
    console.error('[MEDIA UPLOAD] Error:', err)
    return serverError('File upload failed')
  }
}
