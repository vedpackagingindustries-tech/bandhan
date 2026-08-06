// ═══════════════════════════════════════════════════════════
// MEDIA SERVICE
// Handles upload, processing, and retrieval of media files.
// Production: replace local storage with S3/GCS + CDN.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export const MAX_FILE_SIZES: Record<string, number> = {
  PROFILE: 5 * 1024 * 1024,      // 5 MB
  BUSINESS: 10 * 1024 * 1024,     // 10 MB
  ADVERTISEMENT: 10 * 1024 * 1024, // 10 MB
  DOCUMENT: 20 * 1024 * 1024,     // 20 MB
  GENERAL: 5 * 1024 * 1024,       // 5 MB
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
 * Create a media record in the database.
 * In production, this would be called after actual file upload to S3/GCS.
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
 * Delete a media record.
 */
export async function deleteMedia(mediaId: string, userId: string, ipAddress?: string, userAgent?: string) {
  const media = await db.media.findFirst({ where: { id: mediaId, userId } })
  if (!media) return false

  // TODO: Delete actual file from storage (S3/GCS)
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
 * Process image: generate thumbnail URL stub.
 * Production: use Sharp/ImageMagick for actual processing.
 */
export function generateThumbnailUrl(originalUrl: string, size = '300x300'): string {
  // TODO: In production, generate actual thumbnail via image processing pipeline
  // and store on CDN. For now, return a CDN-ready URL pattern.
  return `${originalUrl}?w=${size.split('x')[0]}&h=${size.split('x')[1]}&fit=crop`
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
  return {
    original: baseUrl,
    large: `${baseUrl}?w=1200`,
    medium: `${baseUrl}?w=600`,
    thumbnail: `${baseUrl}?w=150&h=150&fit=crop`,
  }
}
