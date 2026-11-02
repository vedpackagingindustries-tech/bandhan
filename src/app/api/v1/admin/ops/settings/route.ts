import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

const VALID_CATEGORIES = [
  'GENERAL',
  'SECURITY',
  'NOTIFICATION',
  'MEMBERSHIP',
  'AI',
  'ADVERTISEMENT',
] as const

// ═══════════════════════════════════════════════════════════
// GET — List all settings (requireSuperAdmin)
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const category = sp.get('category')

    const where: Record<string, unknown> = {}
    if (category && VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
      where.category = category
    }

    const settings = await db.systemConfiguration.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    // Group by category
    const grouped: Record<string, typeof settings> = {}
    for (const setting of settings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = []
      }
      grouped[setting.category].push(setting)
    }

    return success({
      settings,
      grouped,
    })
  } catch (err) {
    console.error('[ADMIN_SETTINGS] GET error:', err)
    return serverError('Failed to retrieve settings')
  }
}

// ═══════════════════════════════════════════════════════════
// PUT — Upsert settings (requireSuperAdmin)
// ═══════════════════════════════════════════════════════════
export async function PUT(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const body = await request.json()
    const { settings } = body

    if (!Array.isArray(settings) || settings.length === 0) {
      return error('settings must be a non-empty array of { key, value, description?, category? }', 400)
    }

    // Validate all entries
    for (const s of settings) {
      if (!s.key || typeof s.key !== 'string') {
        return error('Each setting must have a valid string key', 400)
      }
      if (s.value === undefined || s.value === null) {
        return error(`Setting "${s.key}" must have a value`, 400)
      }
      if (s.category && !VALID_CATEGORIES.includes(s.category)) {
        return error(
          `Invalid category "${s.category}" for key "${s.key}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
          400
        )
      }
    }

    const { auth } = result
    const { ipAddress, userAgent } = getClientInfo(request)

    // Upsert each setting
    const updated: Record<string, unknown>[] = []
    for (const s of settings) {
      const record = await db.systemConfiguration.upsert({
        where: { key: s.key },
        update: {
          value: String(s.value),
          description: s.description ?? undefined,
          category: s.category ?? undefined,
          updatedAt: new Date(),
        },
        create: {
          key: s.key,
          value: String(s.value),
          description: s.description ?? null,
          category: s.category ?? 'GENERAL',
        },
      })
      updated.push(record)
    }

    await logAudit({
      userId: auth.user.id,
      action: 'admin.settings_update',
      entity: 'SystemConfiguration',
      details: {
        keys: settings.map((s: { key: string }) => s.key),
        count: settings.length,
      },
      ipAddress,
      userAgent,
    })

    return success({
      updated,
      count: updated.length,
    })
  } catch (err) {
    console.error('[ADMIN_SETTINGS] PUT error:', err)
    return serverError('Failed to update settings')
  }
}
