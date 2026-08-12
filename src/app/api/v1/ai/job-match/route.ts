import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { matchCandidateToJob, matchJobToCandidates } from '@/services/ai/job-matching'
import { NextRequest } from 'next/server'

/**
 * AI Job Matching
 * POST /api/v1/ai/job-match — Match candidate to job
 *   Body: { candidateId, jobId }
 * GET /api/v1/ai/job-match?jobId=xxx — Get candidate matches for a job (employer)
 */

export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const body = await request.json()
    const { candidateId, jobId } = body
    if (!jobId) return error('jobId is required')

    const targetCandidateId = candidateId || result.auth.userId
    const matchResult = await matchCandidateToJob({
      candidateId: targetCandidateId,
      jobId,
      userId: result.auth.userId,
    })

    return success(matchResult)
  } catch (err) {
    console.error('[AI JOB_MATCH] Error:', err)
    return serverError('Job matching failed')
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    if (!jobId) return error('jobId is required')
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))

    const matches = await matchJobToCandidates({ jobId, limit })
    return success(matches)
  } catch (err) {
    console.error('[AI JOB_MATCH] GET Error:', err)
    return serverError('Failed to get job matches')
  }
}
