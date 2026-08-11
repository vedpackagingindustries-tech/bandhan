import { db } from '@/lib/db'
import { success, error, serverError } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const status = searchParams.get('status')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = { job: { employerId: (result as any).auth.userId } }
    if (jobId) where.jobId = jobId
    if (status) where.status = status

    const [items, total] = await Promise.all([
      db.jobApplication.findMany({
        where, include: { candidate: { select: { id: true, profile: { select: { firstName: true, lastName: true, city: true, education: true, occupation: true, profilePhotoUrl: true } } } } },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      db.jobApplication.count({ where }),
    ])
    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[EMPLOYER APPS GET] Error:', err)
    return error('Failed to fetch applications')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const body = await request.json()
    const { id, status, employerNote } = body
    if (!id || !status) return error('ID and status required')
    const VALID = ['VIEWED', 'SHORTLISTED', 'REJECTED', 'HIRED']
    if (!VALID.includes(status)) return error(`Invalid status. Use: ${VALID.join(', ')}`)

    const app = await db.jobApplication.findUnique({ where: { id }, include: { job: { select: { employerId: true, title: true } } } })
    if (!app || app.job.employerId !== (result as any).auth.userId) return error('Application not found', 404)

    const data: Record<string, Date | string> = { status }
    if (status === 'VIEWED') data.viewedAt = new Date()
    if (status === 'SHORTLISTED') data.shortlistedAt = new Date()
    if (status === 'REJECTED') data.rejectedAt = new Date()
    if (status === 'HIRED') data.hiredAt = new Date()
    if (employerNote) (data as any).employerNote = employerNote

    const updated = await db.jobApplication.update({ where: { id }, data })
    await createNotification({ userId: app.candidateId, type: 'JOB_APPLICATION', title: `Application ${status}`, message: `Your application for "${app.job.title}" has been ${status.toLowerCase()}.` })
    return success({ application: updated })
  } catch (err) {
    console.error('[EMPLOYER APP PATCH] Error:', err)
    return serverError('Failed to update application')
  }
}