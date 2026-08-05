import { db } from '@/lib/db'

export async function logAudit(params: {
  userId?: string
  action: string
  entity?: string
  entityId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (err) {
    console.error('[AUDIT] Failed to log:', err)
  }
}

export async function logSecurityEvent(params: {
  userId?: string
  eventType: string
  description?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
  severity?: 'INFO' | 'WARNING' | 'CRITICAL'
}) {
  try {
    await db.securityEvent.create({
      data: {
        userId: params.userId,
        eventType: params.eventType,
        description: params.description,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        severity: params.severity ?? 'INFO',
      },
    })
  } catch (err) {
    console.error('[SECURITY] Failed to log event:', err)
  }
}
