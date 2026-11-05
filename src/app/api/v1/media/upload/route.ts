import { db } from '@/lib/db'
import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { put } from '@vercel/blob'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// MEDIA UPLOAD — authenticated multipart upload to Vercel Blob.
// Security: session required, MIME whitelist, hard size cap
// (Vercel serverless body limit ≈ 4.5 MB), user-scoped pathnames.
// ═══════════════════════════════════════════════════════════════

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB — Vercel request body limit safe

const MIME_WHITELIST: Record<string, { type: string; ext: string }> = {
  'image/jpeg': { type: 'IMAGE', ext: 'jpg' },
  'image/png': { type: 'IMAGE', ext: 'png' },
  'image/webp': { type: 'IMAGE', ext: 'webp' },
  'image/gif': { type: 'IMAGE', ext: 'gif' },
  'video/mp4': { type: 'VIDEO', ext: 'mp4' },
  'video/webm': { type: 'VIDEO', ext: 'webm' },
  'application/pdf': { type: 'DOCUMENT', ext: 'pdf' },
}

const VALID_CATEGORIES = ['PROFILE', 'BUSINESS', 'ADVERTISEMENT', 'DOCUMENT', 'GENERAL']

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return error('Media storage is not configured on this deployment (missing BLOB_READ_WRITE_TOKEN).', 503)
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return error('multipart/form-data body expected with a "file" field.', 400)
    }

    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return error('Please attach a file in the "file" field.', 400)
    }

    if (file.size > MAX_BYTES) {
      return error('File too large — maximum allowed size is 4 MB.', 413)
    }

    const mime = (file.type || '').toLowerCase()
    const spec = MIME_WHITELIST[mime]
    if (!spec) {
      return error('File type not allowed. Allowed: JPG, PNG, WEBP, GIF, MP4, WEBM, PDF.', 415)
    }

    const rawCategory = String(form.get('category') || 'GENERAL').toUpperCase()
    const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : 'GENERAL'

    const safeBase = (file.name || `upload.${spec.ext}`)
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(-64) || `upload.${spec.ext}`

    const pathname = `media/${auth.userId}/${Date.now()}-${safeBase}`

    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: mime,
    })

    const media = await db.media.create({
      data: {
        userId: auth.userId,
        category,
        type: spec.type,
        fileName: safeBase,
        fileSize: file.size,
        mimeType: mime,
        url: blob.url,
      },
    })

    return success({ media }, 201)
  } catch (e) {
    console.error('[media/upload]', e)
    return serverError('Upload failed. Please try again.')
  }
}
