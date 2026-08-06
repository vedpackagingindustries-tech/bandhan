import { db } from '@/lib/db'
import { success, error, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { invalidateRoleCache } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

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
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { roleId, permissionIds } = body

    if (!roleId) return error('Role ID is required')

    // Verify role exists
    const role = await db.role.findUnique({ where: { id: roleId } })
    if (!role) return error('Role not found', 404)

    // Replace permissions for role
    await db.rolePermission.deleteMany({ where: { roleId } })

    if (permissionIds && permissionIds.length > 0) {
      await db.rolePermission.createMany({
        data: permissionIds.map((pid: string) => ({ roleId, permissionId: pid })),
      })
    }

    // Invalidate cache so new permissions take effect immediately
    await invalidateRoleCache(role.name)

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'admin.role_permissions_update',
      entity: 'Role',
      entityId: roleId,
      details: { roleName: role.name, permissionCount: permissionIds?.length || 0 },
      ipAddress,
      userAgent,
    })

    return success({ message: 'Role permissions updated. Changes take effect immediately.' })
  } catch (err) {
    console.error('[ADMIN ROLES UPDATE] Error:', err)
    return error('Failed to update role permissions')
  }
}
