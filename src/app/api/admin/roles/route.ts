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

    const roles = await db.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { level: 'desc' },
    })

    const allPermissions = await db.permission.findMany({ orderBy: { module: 'asc' } })

    return success({ roles, allPermissions })
  } catch (err) {
    console.error('[ADMIN ROLES] Error:', err)
    return error('Failed to fetch roles')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({
      where: { token },
      include: { user: { include: { role: true } } },
    })

    if (!session || session.expiresAt < new Date()) return unauthorized()
    if (!isAdmin(session.user.role?.name)) return error('Admin access required', 403)

    const body = await request.json()
    const { roleId, permissionIds } = body

    if (!roleId) return error('Role ID is required')

    // Replace permissions for role
    await db.rolePermission.deleteMany({ where: { roleId } })

    if (permissionIds && permissionIds.length > 0) {
      await db.rolePermission.createMany({
        data: permissionIds.map((pid: string) => ({ roleId, permissionId: pid })),
      })
    }

    return success({ message: 'Role permissions updated' })
  } catch (err) {
    console.error('[ADMIN ROLES UPDATE] Error:', err)
    return error('Failed to update role permissions')
  }
}
