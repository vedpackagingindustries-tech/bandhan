'use server'

import { db } from '@/lib/db'
import { unauthorized, success, error, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'application/pdf',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({ where: { token } })
    if (!session || session.expiresAt < new Date()) return unauthorized()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const category = formData.get('category') as string || 'GENERAL'

    if (!file) return error('No file provided')

    // Validate
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return error('File type not allowed')
    }
    if (file.size > MAX_FILE_SIZE) {
      return error('File too large. Max 10MB.')
    }

    const { ipAddress, userAgent } = getClientInfo(request)

    // Generate unique filename
    const ext = path.extname(file.name) || '.' + file.type.split('/')[1]
    const uniqueName = `${session.userId}-${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`
    const relativePath = `/uploads/${uniqueName}`
    const absolutePath = path.join(process.cwd(), 'public', 'uploads', uniqueName)

    // Ensure directory exists
    await mkdir(path.join(process.cwd(), 'public', 'uploads'), { recursive: true })

    // Write file
    const bytes = await file.arrayBuffer()
    await writeFile(absolutePath, Buffer.from(bytes))

    // Determine type
    const mediaType = file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT'

    // Save to database
    const media = await db.media.create({
      data: {
        userId: session.userId,
        category,
        type: mediaType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        url: relativePath,
      },
    })

    await logAudit({
      userId: session.userId,
      action: 'media.upload',
      entity: 'Media',
      entityId: media.id,
      details: { fileName: file.name, size: file.size, type: mediaType, category },
      ipAddress,
      userAgent,
    })

    return success({ media, url: relativePath }, 201)
  } catch (err) {
    console.error('[MEDIA UPLOAD] Error:', err)
    return error('File upload failed')
  }
}
