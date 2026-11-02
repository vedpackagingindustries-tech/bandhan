
import { db } from '@/lib/db'
import { unauthorized, success, error } from '@/lib/api-response'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized('No session token')

    const session = await db.userSession.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
            profile: true,
            memberships: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    })

    if (!session || session.expiresAt < new Date()) {
      return unauthorized('Invalid or expired session')
    }

    const user = session.user
    if (user.status !== 'ACTIVE') {
      return error('Account is not active', 403)
    }

    return success({
      id: user.id,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      status: user.status,
      membershipTier: user.membershipTier,
      registrationCategory: user.registrationCategory,
      roleName: user.role?.name,
      permissions: user.role?.permissions.map((rp) => rp.permission.name) || [],
      profile: user.profile,
      membership: user.memberships[0] || null,
    })
  } catch (err) {
    console.error('[AUTH ME] Error:', err)
    return error('Failed to fetch user')
  }
}
