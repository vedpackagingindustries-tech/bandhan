import { success, error, serverError } from '@/lib/api-response'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { invalidateProviderCache } from '@/services/ai/provider'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const providers = await db.aIProviderConfig.findMany({ orderBy: { priority: 'desc' } })
    return success(providers.map(p => ({
      id: p.id, provider: p.provider, displayName: p.displayName,
      description: p.description, enabled: p.enabled,
      capabilities: JSON.parse(p.capabilities || '[]'),
      priority: p.priority, rateLimitRpm: p.rateLimitRpm, costPer1kTok: p.costPer1kTok,
    })))
  } catch (err) {
    console.error('[AI ADMIN PROVIDERS] Error:', err)
    return serverError('Failed to get providers')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const body = await request.json()
    if (!body.provider || !body.displayName) return error('provider and displayName required')

    const created = await db.aIProviderConfig.create({
      data: {
        provider: body.provider, displayName: body.displayName,
        description: body.description, enabled: body.enabled ?? true,
        config: JSON.stringify(body.config || {}),
        capabilities: JSON.stringify(body.capabilities || []),
        priority: body.priority ?? 0, rateLimitRpm: body.rateLimitRpm ?? 60,
        costPer1kTok: body.costPer1kTok ?? 0,
      },
    })

    invalidateProviderCache()
    return success(created)
  } catch (err) {
    console.error('[AI ADMIN PROVIDERS] POST Error:', err)
    return serverError('Failed to create provider')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const body = await request.json()
    if (!body.id) return error('id is required')

    const data: Record<string, unknown> = {}
    if (body.displayName !== undefined) data.displayName = body.displayName
    if (body.description !== undefined) data.description = body.description
    if (body.enabled !== undefined) data.enabled = body.enabled
    if (body.config !== undefined) data.config = JSON.stringify(body.config)
    if (body.capabilities !== undefined) data.capabilities = JSON.stringify(body.capabilities)
    if (body.priority !== undefined) data.priority = body.priority
    if (body.rateLimitRpm !== undefined) data.rateLimitRpm = body.rateLimitRpm
    if (body.costPer1kTok !== undefined) data.costPer1kTok = body.costPer1kTok

    const updated = await db.aIProviderConfig.update({ where: { id: body.id }, data })
    invalidateProviderCache()
    return success(updated)
  } catch (err) {
    console.error('[AI ADMIN PROVIDERS] PUT Error:', err)
    return serverError('Failed to update provider')
  }
}
