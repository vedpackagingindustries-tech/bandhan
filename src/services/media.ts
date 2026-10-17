// ═══════════════════════════════════════════════════════════
// MEDIA SERVICE — PRODUCTION CLOUD STORAGE
// Uses @vercel/blob for durable, CDN-backed file storage.
// Falls back to local filesystem in development.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { put, del } from '@vercel/blob'
import { existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export const MAX_FILE_SIZES: Record<string, number> = {
  PROFILE: 5 * 1024 * 1024,
  BUSINESS: 10 * 1024 * 1024,
  ADVERTISEMENT: 10 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024,
  GENERAL: 5 * 1024 * 1024,
}

export const MEDIA_CATEGORIES = ['PROFILE', 'BUSINESS', 'ADVERTISEMENT', 'DOCUMENT', 'GENERAL'] as const
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number]

export interface UploadResult {
  mediaId: string
  url: string
  thumbnailUrl?: string
  fileName: string
  fileSize: number
  width?: number
  height?: number
}

export interface ProcessedImageResult {
  originalPath: string
  largePath: string
  mediumPath: string
  thumbnailPath: string
  width: number
  height: number
}

/**
 * Validate file before upload.
 */
export function validateMediaFile(
  file: { name: string; type: string; size: number },
  category: string
): { valid: boolean; error?: string } {
  if (!MEDIA_CATEGORIES.includes(category as MediaCategory)) {
    return { valid: false, error: 'Invalid media category' }
  }

  const maxSize = MAX_FILE_SIZES[category] || MAX_FILE_SIZES.GENERAL
  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Max ${maxSize / (1024 * 1024)}MB for ${category}` }
  }

  if (file.size === 0) {
    return { valid: false, error: 'Empty file' }
  }

  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
  const isDoc = ALLOWED_DOCUMENT_TYPES.includes(file.type)

  if (!isImage && !isDoc) {
    return { valid: false, error: `Unsupported file type: ${file.type}` }
  }

  return { valid: true }
}

/**
 * Upload file to cloud storage (Vercel Blob) or local filesystem.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(
  file: { name: string; type: string; size: number; data: Buffer | ArrayBuffer },
  category: string,
  userId: string
): Promise<{ url: string; thumbnailUrl?: string }> {
  const buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data)

  // Production: Use Vercel Blob (S3-compatible, CDN-backed)
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL) {
    try {
      const blob = await put(`uploads/${category}/${userId}/${file.name}`, buffer, {
        access: 'public',
        contentType: file.type,
        addRandomSuffix: true, // Prevent name collisions
      })

      return {
        url: blob.url,
        // Vercel Blob doesn't auto-generate thumbnails;
        // we use URL params for image resizing via next/image
        thumbnailUrl: `${blob.url}?w=300&h=300&fit=crop`,
      }
    } catch (err) {
      console.error('[MEDIA] Vercel Blob upload failed, falling back to local:', err)
      // Fall through to local storage
    }
  }

  // Local filesystem fallback (development)
  const uploadsDir = join(process.cwd(), 'uploads', category, userId)
  mkdirSync(uploadsDir, { recursive: true })

  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`
  const filePath = join(uploadsDir, uniqueName)
  writeFileSync(filePath, buffer)

  const url = `/uploads/${category}/${userId}/${uniqueName}`
  return { url, thumbnailUrl: `${url}?w=300&h=300&fit=crop` }
}

/**
 * Delete a file from cloud storage (Vercel Blob) or local filesystem.
 */
export async function deleteFile(url: string): Promise<boolean> {
  // Vercel Blob URLs start with https://
  if (url.startsWith('https://') && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(url)
      return true
    } catch (err) {
      console.error('[MEDIA] Vercel Blob delete failed:', err)
      return false
    }
  }

  // Local filesystem
  try {
    const uploadsDir = join(process.cwd(), 'uploads')
    const resolvedPath = join(process.cwd(), url)
    if (resolvedPath.startsWith(uploadsDir) && existsSync(resolvedPath)) {
      unlinkSync(resolvedPath)
      return true
    }
  } catch (err) {
    console.error('[MEDIA] Local file delete failed:', err)
  }

  return false
}

/**
 * Create a media record in the database.
 */
export async function createMediaRecord(params: {
  userId: string
  category: string
  type: string
  fileName: string
  fileSize: number
  mimeType: string
  url: string
  thumbnailUrl?: string
  width?: number
  height?: number
  alt?: string
  isPublic?: boolean
}): Promise<UploadResult> {
  const media = await db.media.create({
    data: {
      userId: params.userId,
      category: params.category,
      type: params.type,
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      url: params.url,
      thumbnailUrl: params.thumbnailUrl,
      width: params.width,
      height: params.height,
      alt: params.alt,
      isPublic: params.isPublic ?? true,
    },
  })

  return {
    mediaId: media.id,
    url: media.url,
    thumbnailUrl: media.thumbnailUrl ?? undefined,
    fileName: media.fileName,
    fileSize: media.fileSize,
    width: media.width ?? undefined,
    height: media.height ?? undefined,
  }
}

/**
 * Get media records for a user.
 */
export async function getUserMedia(
  userId: string,
  category?: string
) {
  const where: Record<string, unknown> = { userId }
  if (category) where.category = category

  return db.media.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
  })
}

/**
 * Delete a media record and the actual file from storage.
 */
export async function deleteMedia(mediaId: string, userId: string, ipAddress?: string, userAgent?: string) {
  const media = await db.media.findFirst({ where: { id: mediaId, userId } })
  if (!media) return false

  // Delete the actual file from cloud/local storage
  await deleteFile(media.url)

  // Delete thumbnail variant if it exists
  if (media.thumbnailUrl) {
    await deleteFile(media.thumbnailUrl)
  }

  await db.media.delete({ where: { id: mediaId } })

  await logAudit({
    userId,
    action: 'media.delete',
    entity: 'Media',
    entityId: mediaId,
    details: { fileName: media.fileName, category: media.category },
    ipAddress,
    userAgent,
  })

  return true
}

/**
 * Process an uploaded image: generate multiple resolutions.
 * Uses Sharp for actual image processing.
 */
export async function processImage(inputPath: string): Promise<ProcessedImageResult | null> {
  try {
    const sharp = (await import('sharp')).default
    const metadata = await sharp(inputPath).metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0

    const dir = inputPath.substring(0, inputPath.lastIndexOf('/'))
    const ext = inputPath.split('.').pop() || 'jpg'
    const baseName = inputPath.replace(`.${ext}`, '')

    // Large: max 1200px wide
    const largePath = `${baseName}_large.${ext}`
    await sharp(inputPath)
      .resize(1200, null, { withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toFile(largePath)

    // Medium: max 600px wide
    const mediumPath = `${baseName}_medium.${ext}`
    await sharp(inputPath)
      .resize(600, null, { withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toFile(mediumPath)

    // Thumbnail: 300x300 crop
    const thumbnailPath = `${baseName}_thumb.${ext}`
    await sharp(inputPath)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 75 })
      .toFile(thumbnailPath)

    // Compress original
    await sharp(inputPath)
      .jpeg({ quality: 85, progressive: true })
      .toFile(inputPath)

    return {
      originalPath: inputPath,
      largePath,
      mediumPath,
      thumbnailPath,
      width,
      height,
    }
  } catch (err) {
    console.error('[MEDIA] Image processing failed:', err)
    return null
  }
}

/**
 * Get multi-resolution image URLs for CDN delivery.
 */
export function getMultiResolutionUrls(baseUrl: string): {
  original: string
  large: string
  medium: string
  thumbnail: string
} {
  const dotIdx = baseUrl.lastIndexOf('.')
  const base = dotIdx > -1 ? baseUrl.substring(0, dotIdx) : baseUrl
  const ext = dotIdx > -1 ? baseUrl.substring(dotIdx) : '.jpg'

  return {
    original: baseUrl,
    large: `${base}_large${ext}`,
    medium: `${base}_medium${ext}`,
    thumbnail: `${base}_thumb${ext}`,
  }
}

/**
 * Generate a CDN-ready URL with transformation parameters.
 */
export function getCdnUrl(originalUrl: string, options?: {
  width?: number
  height?: number
  fit?: 'cover' | 'contain' | 'fill'
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
}): string {
  if (!options) return originalUrl

  const params: string[] = []
  if (options.width) params.push(`w=${options.width}`)
  if (options.height) params.push(`h=${options.height}`)
  if (options.fit) params.push(`fit=${options.fit}`)
  if (options.quality) params.push(`q=${options.quality}`)
  if (options.format) params.push(`f=${options.format}`)

  return params.length > 0 ? `${originalUrl}?${params.join('&')}` : originalUrl
}
