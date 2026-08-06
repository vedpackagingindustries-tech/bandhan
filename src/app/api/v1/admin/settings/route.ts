import { db } from '@/lib/db'
import { unauthorized, success, error, forbidden, getClientInfo } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}
    if (category) where.category = category

    const configs = await db.systemConfiguration.findMany({
      where,
      orderBy: { category: 'asc' },
    })

    return success({ configs })
  } catch (err) {
    console.error('[SETTINGS GET] Error:', err)
    return error('Failed to fetch settings')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error
    const { auth } = result

    if (!auth.user.role || auth.user.role.name !== 'SUPER_ADMIN') {
      return forbidden('Only Super Admin can modify settings')
    }

    const body = await request.json()
    const { settings } = body as { settings: { key: string; value: string; category?: string; description?: string; isPublic?: boolean }[] }

    if (!settings || !Array.isArray(settings)) {
      return error('Settings array is required')
    }

    const results = []
    for (const setting of settings) {
      const config = await db.systemConfiguration.upsert({
        where: { key: setting.key },
        update: {
          value: setting.value,
          ...(setting.category ? { category: setting.category } : {}),
          ...(setting.description !== undefined ? { description: setting.description } : {}),
          ...(setting.isPublic !== undefined ? { isPublic: setting.isPublic } : {}),
        },
        create: {
          key: setting.key,
          value: setting.value,
          category: setting.category || 'GENERAL',
          description: setting.description,
          isPublic: setting.isPublic ?? false,
        },
      })
      results.push(config)
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'admin.settings_update',
      entity: 'SystemConfiguration',
      details: { keysUpdated: settings.map((s) => s.key) },
      ipAddress,
      userAgent,
    })

    return success({ updated: results.length, settings: results })
  } catch (err) {
    console.error('[SETTINGS PUT] Error:', err)
    return error('Failed to update settings')
  }
}
