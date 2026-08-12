import { db } from '@/lib/db'
import { requireSuperAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'

const VALID_TYPES = ['DATABASE', 'MEDIA', 'CONFIG']
const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']

// ═══════════════════════════════════════════════════════════
// GET — List backup records (requireSuperAdmin)
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const type = sp.get('type')
    const status = sp.get('status')

    const where: Record<string, unknown> = {}
    if (type && VALID_TYPES.includes(type)) where.type = type
    if (status && VALID_STATUSES.includes(status)) where.status = status

    const [records, total] = await Promise.all([
      db.backupRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.backupRecord.count({ where }),
    ])

    return success({
      records,
      pagination: paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[BACKUPS] GET error:', err)
    return serverError('Failed to retrieve backup records')
  }
}

// ═══════════════════════════════════════════════════════════
// POST — Trigger backup (requireSuperAdmin)
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const body = await request.json()
    const { type, notes, retentionDays } = body

    if (!type || !VALID_TYPES.includes(type)) {
      return error('Invalid or missing backup type. Must be DATABASE, MEDIA, or CONFIG.', 400)
    }

    const { auth } = result
    const { ipAddress, userAgent } = getClientInfo(request)
    const now = new Date()
    const retention = typeof retentionDays === 'number' ? retentionDays : 90

    // Create backup record with IN_PROGRESS status
    const record = await db.backupRecord.create({
      data: {
        type,
        status: 'IN_PROGRESS',
        triggeredBy: auth.user.id,
        triggeredByRole: auth.user.role?.name ?? null,
        notes: notes ?? null,
        retentionDays: retention,
        expiresAt: new Date(now.getTime() + retention * 24 * 60 * 60 * 1000),
      },
    })

    try {
      if (type === 'DATABASE') {
        // Perform actual database file copy
        const dbDir = path.join(process.cwd(), 'db')
        const backupsDir = path.join(dbDir, 'backups')

        // Create backups directory if not exists
        if (!fs.existsSync(backupsDir)) {
          fs.mkdirSync(backupsDir, { recursive: true })
        }

        const sourcePath = path.join(dbDir, 'custom.db')
        const timestamp = now.toISOString().replace(/[:.]/g, '-')
        const fileName = `backup-${timestamp}.db`
        const destPath = path.join(backupsDir, fileName)

        if (!fs.existsSync(sourcePath)) {
          throw new Error('Database file not found')
        }

        // Copy the database file
        fs.copyFileSync(sourcePath, destPath)

        // Get file size
        const stats = fs.statSync(destPath)

        // Update record as completed
        const completed = await db.backupRecord.update({
          where: { id: record.id },
          data: {
            status: 'COMPLETED',
            filePath: destPath,
            fileSize: stats.size,
            completedAt: now,
          },
        })

        await logAudit({
          userId: auth.user.id,
          action: 'admin.backup_create',
          entity: 'BackupRecord',
          entityId: record.id,
          details: { type, fileSize: stats.size, retentionDays: retention },
          ipAddress,
          userAgent,
        })

        return success(completed)
      }

      // MEDIA / CONFIG backups (placeholder — production would use cloud storage)
      const completed = await db.backupRecord.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          notes: (notes ?? '') + ' [Simulated — production requires cloud storage integration]',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.backup_create',
        entity: 'BackupRecord',
        entityId: record.id,
        details: { type, retentionDays: retention, simulated: true },
        ipAddress,
        userAgent,
      })

      return success(completed)
    } catch (backupErr) {
      // Mark record as failed
      const failed = await db.backupRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          error: backupErr instanceof Error ? backupErr.message : 'Unknown backup error',
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.backup_failed',
        entity: 'BackupRecord',
        entityId: record.id,
        details: { type, error: backupErr instanceof Error ? backupErr.message : 'Unknown error' },
        ipAddress,
        userAgent,
      })

      return success(failed)
    }
  } catch (err) {
    console.error('[BACKUPS] POST error:', err)
    return serverError('Failed to create backup')
  }
}
