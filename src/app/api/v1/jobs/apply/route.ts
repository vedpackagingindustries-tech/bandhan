import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

/** POST /api/v1/jobs/apply — Apply to a job (CANDIDATE, FREE FOR LIFE) */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { jobId, coverLetter, resumeUrl } = body
    if (!jobId) return error('Job ID is required')

    const job = await db.job.findUnique({ where: { id: jobId } })
    if (!job || job.status !== 'ACTIVE') return error('Job not available', 404)
    if (job.employerId === auth.userId) return error('Cannot apply to own job')

    const existing = await db.jobApplication.findUnique({ where: { jobId_candidateId: { jobId, candidateId: auth.userId } } })
    if (existing) return error('Already applied to this job')

    const { ipAddress, userAgent } = getClientInfo(request)
    const application = await db.jobApplication.create({
      data: { jobId, candidateId: auth.userId, coverLetter, resumeUrl, status: 'APPLIED' },
    })
    await db.job.update({ where: { id: jobId }, data: { applicationsCount: { increment: 1 } } })

    await createNotification({ userId: job.employerId, type: 'JOB_APPLICATION', title: 'New Job Application', message: `A candidate applied to your job: ${job.title}` })
    await logAudit({ userId: auth.userId, action: 'job.apply', entity: 'JobApplication', entityId: application.id, details: { jobId }, ipAddress, userAgent })

    return success({ application }, 201)
  } catch (err) {
    console.error('[JOB APPLY] Error:', err)
    return serverError('Failed to apply')
  }
}

/** GET /api/v1/jobs/apply — List my applications (candidate) */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = parsePagination(searchParams)

    const where = { candidateId: auth.userId }
    const [items, total] = await Promise.all([
      db.jobApplication.findMany({
        where,
        include: {
          job: { select: { id: true, title: true, type: true, status: true, employer: { select: { profile: { select: { firstName: true, lastName: true, businessName: true } } } } } },
        },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      db.jobApplication.count({ where }),
    ])

    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[MY APPLICATIONS] Error:', err)
    return error('Failed to fetch applications')
  }
}
