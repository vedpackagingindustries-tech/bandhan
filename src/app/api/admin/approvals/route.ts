'use server'

import { db } from '@/lib/db'
import { unauthorized, success, error, isAdmin } from '@/lib/api-response'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({
      where: { token },
      include: { user: { include: { role: true } } },
    })

    if (!session || session.expiresAt < new Date()) return unauthorized()
    if (!isAdmin(session.user.role?.name)) return error('Admin access required', 403)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

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
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.approval.count({ where }),
    ])

    return success({ approvals, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (err) {
    console.error('[ADMIN APPROVALS] Error:', err)
    return error('Failed to fetch approvals')
  }
}
