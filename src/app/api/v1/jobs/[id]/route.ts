import { db } from '@/lib/db'
import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    // PRIVACY: explicit whitelist — employer's contactEmail/contactPhone/applyUrl
    // are NEVER returned publicly. Interested users press CONNECT or APPLY;
    // the admin mediates contact.
    const job = await db.job.findUnique({
      where: { id },
      select: {
        id: true, employerId: true, title: true, description: true, category: true, type: true,
        salaryMin: true, salaryMax: true, salaryCurrency: true, experience: true,
        skills: true, education: true, vacancies: true, location: true,
        isRemote: true, isFeatured: true, featuredExpiry: true, status: true,
        viewsCount: true, applicationsCount: true, createdAt: true, expiresAt: true,
        employer: { select: { id: true, profile: { select: { firstName: true, lastName: true, businessName: true, companyName: true, city: true, state: true } } } },
        district: { select: { id: true, name: true, nameHi: true } },
        city: { select: { id: true, name: true, nameHi: true } },
        _count: { select: { applications: true } },
      },
    })
    if (!job || job.status !== 'ACTIVE') return error('Job not found', 404)

    await db.job.update({ where: { id }, data: { viewsCount: { increment: 1 } } })

    const app = await db.jobApplication.findUnique({ where: { jobId_candidateId: { jobId: id, candidateId: auth.userId } } })

    return success({
      ...job,
      contactEmail: null,  // never exposed publicly — use CONNECT/APPLY
      contactPhone: null,  // never exposed publicly — use CONNECT/APPLY
      viewsCount: job.viewsCount + 1,
      hasApplied: !!app,
    })
  } catch (err) {
    console.error('[JOB DETAIL] Error:', err)
    return serverError('Failed to fetch job')
  }
}
