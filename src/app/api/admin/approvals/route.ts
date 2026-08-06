import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'
    const { page, limit, skip } = parsePagination(searchParams)

    const where: Record<string, unknown> = {}
    if (status !== 'ALL') where.status = status

    const [approvals, total] = await Promise.all([
      db.approval.findMany({
        where,
        include: {
          user: {
            include: {
              profile: { select: { firstName: true, lastName: true, displayName: true, city: true } },
              role: { select: { name: true, displayName: true } },
            },
          },
          reviewer: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.approval.count({ where }),
    ])

    return success({ approvals, pagination: paginate(page, limit, total) })
  } catch (err) {
    console.error('[ADMIN APPROVALS] Error:', err)
    return error('Failed to fetch approvals')
  }
}
