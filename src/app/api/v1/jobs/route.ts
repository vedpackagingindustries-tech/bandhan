import { db } from '@/lib/db'
import { success, error, unauthorized, forbidden, getClientInfo } from '@/lib/api-response'
import { requireAuth, requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

/** GET /api/v1/jobs — List ACTIVE jobs with filters */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const districtId = searchParams.get('districtId')
    const cityId = searchParams.get('cityId')
    const isRemote = searchParams.get('isRemote') === 'true'
    const experience = searchParams.get('experience')
    const search = searchParams.get('search')
    const isFeatured = searchParams.get('featured') === 'true'
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = { status: 'ACTIVE', expiresAt: { gte: new Date() } }
    if (category) where.category = category
    if (type) where.type = type
    if (districtId) where.districtId = districtId
    if (cityId) where.cityId = cityId
    if (isRemote) where.isRemote = true
    if (experience) where.experience = experience
    if (isFeatured) where.isFeatured = true
    if (search) where.title = { contains: search }

    const [items, total] = await Promise.all([
      db.job.findMany({
        where,
        select: {
          id: true, title: true, description: true, category: true, type: true,
          salaryMin: true, salaryMax: true, salaryCurrency: true, experience: true,
          skills: true, education: true, vacancies: true, location: true,
          isRemote: true, isFeatured: true, viewsCount: true, applicationsCount: true,
          createdAt: true, expiresAt: true,
          employer: { select: { id: true, profile: { select: { firstName: true, lastName: true, businessName: true, companyName: true } } } },
          district: { select: { id: true, name: true, nameHi: true } },
          city: { select: { id: true, name: true, nameHi: true } },
        },
        orderBy: isFeatured ? [{ isFeatured: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
        skip, take: limit,
      }),
      db.job.count({ where }),
    ])

    return success({ items, ...paginate(page, limit, total) })
  } catch (err) {
    console.error('[JOBS GET] Error:', err)
    return error('Failed to fetch jobs')
  }
}

/** POST /api/v1/jobs — Create job (EMPLOYER) */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    if (auth.user.status !== 'ACTIVE') return error('Account not active', 403)
    if (auth.user.registrationCategory === 'GENERAL' && auth.user.role?.name === 'FREE_USER') {
      return error('Employer registration required to post jobs', 403)
    }

    const body = await request.json()
    const { title, description, category, type, salaryMin, salaryMax, experience,
      skills, education, vacancies, location, districtId, cityId, isRemote,
      contactEmail, contactPhone, applyUrl, expiresAt } = body

    if (!title || !description) return error('Title and description are required')

    const { ipAddress, userAgent } = getClientInfo(request)
    const job = await db.job.create({
      data: {
        employerId: auth.userId, title, description, category: category || 'OTHER',
        type: type || 'FULL_TIME', salaryMin, salaryMax, experience, skills: skills ? JSON.stringify(skills) : undefined,
        education, vacancies: vacancies || 1, location, districtId, cityId,
        isRemote: isRemote || false, contactEmail, contactPhone, applyUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    await logAudit({ userId: auth.userId, action: 'job.create', entity: 'Job', entityId: job.id, details: { title }, ipAddress, userAgent })
    return success({ job }, 201)
  } catch (err) {
    console.error('[JOBS POST] Error:', err)
    return serverError('Failed to create job')
  }
}
