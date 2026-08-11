import { db } from '@/lib/db'
import { success, error, unauthorized, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/** GET /api/v1/jobs/employer — List own jobs */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = { employerId: auth.userId }
    if (status) where.status = status

    const [items, total] = await Promise.all([
      db.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: { _count: { select: { applications: true } } },
      }),
      db.job.count({ where }),
    ])

    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[EMPLOYER JOBS GET] Error:', err)
    return error('Failed to fetch jobs')
  }
}

/** POST /api/v1/jobs/employer — Update a job */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { id, ...data } = body
    if (!id) return error('Job ID is required')

    const existing = await db.job.findUnique({ where: { id } })
    if (!existing || existing.employerId !== auth.userId) return error('Job not found', 404)

    const updated = await db.job.update({
      where: { id },
      data: { ...data, skills: data.skills ? JSON.stringify(data.skills) : undefined },
    })

    return success({ job: updated })
  } catch (err) {
    console.error('[EMPLOYER JOBS POST] Error:', err)
    return serverError('Failed to update job')
  }
}

/** DELETE /api/v1/jobs/employer — Close a job */
export async function DELETE(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return error('Job ID is required')

    const existing = await db.job.findUnique({ where: { id } })
    if (!existing || existing.employerId !== auth.userId) return error('Job not found', 404)

    await db.job.update({ where: { id }, data: { status: 'CLOSED' } })
    return success({ message: 'Job closed' })
  } catch (err) {
    console.error('[EMPLOYER JOBS DELETE] Error:', err)
    return serverError('Failed to close job')
  }
}