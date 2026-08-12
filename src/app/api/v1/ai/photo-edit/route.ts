import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { editPhoto, getMediaVersions } from '@/services/ai/photo-editor'
import { NextRequest } from 'next/server'

/**
 * AI Photo Editor (Premium/Elite only)
 * POST /api/v1/ai/photo-edit — Edit a photo
 * GET /api/v1/ai/photo-edit?mediaId=xxx — Get all versions
 */

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const body = await request.json()
    const { mediaId, operations } = body
    if (!mediaId || !Array.isArray(operations) || operations.length === 0) {
      return error('mediaId and non-empty operations array are required')
    }

    const validOps = ['BACKGROUND_CLEANUP', 'LIGHTING_ENHANCE', 'RESOLUTION_ENHANCE', 'CROP_ASSIST', 'PROFESSIONAL_FRAMING']
    const invalidOps = operations.filter((op: string) => !validOps.includes(op))
    if (invalidOps.length > 0) {
      return error(`Invalid operations: ${invalidOps.join(', ')}`)
    }

    const editResult = await editPhoto({
      mediaId,
      operations,
      userId: result.auth.userId,
    })

    if (editResult.status === 'FAILED') {
      return error('Photo edit failed. Ensure you have Premium or Elite membership.', 403)
    }

    return success(editResult)
  } catch (err) {
    console.error('[AI PHOTO_EDIT] Error:', err)
    return serverError('Photo edit failed')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get('mediaId')
    if (!mediaId) return error('mediaId is required')

    const versions = await getMediaVersions(mediaId)
    return success(versions)
  } catch (err) {
    console.error('[AI PHOTO_EDIT] GET Error:', err)
    return serverError('Failed to get media versions')
  }
}
