// ═══════════════════════════════════════════════════════════
// TOTP 2FA SETUP & MANAGEMENT
// POST: Enable 2FA (generate secret + backup codes)
// DELETE: Disable 2FA
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { success, error, unauthorized } from '@/lib/api-response'
import { generateTOTPSecret, generateBackupCodes, getTOTPUri } from '@/lib/totp'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

// Extract user ID from Bearer token
async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const session = await db.userSession.findUnique({
    where: { token },
    include: { user: true },
  })
  if (!session || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') return null
  return session.userId
}

// POST: Enable TOTP 2FA
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return unauthorized('Invalid or expired session')

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, totpEnabled: true } })
    if (!user) return unauthorized('User not found')

    if (user.totpEnabled) {
      return error('2FA is already enabled. Disable it first to regenerate.')
    }

    // Generate TOTP secret
    const secret = generateTOTPSecret()
    const backupCodes = generateBackupCodes(8)
    const email = user.email || 'user@bandhan.app'
    const otpauthUri = getTOTPUri(secret, email)

    // Store secret and backup codes (backup codes stored as plain for user to save,
    // they become single-use hashed on first verification)
    await db.user.update({
      where: { id: userId },
      data: {
        totpSecret: secret,
        totpEnabled: true,
        totpBackupCodes: JSON.stringify(backupCodes),
      },
    })

    await logAudit({
      userId,
      action: 'user.2fa.enable',
      entity: 'User',
      entityId: userId,
    })

    return success({
      secret,
      otpauthUri,
      backupCodes,
      message: '2FA enabled. Save your backup codes in a safe place.',
    })
  } catch (err) {
    console.error('[2FA] Enable error:', err)
    return error('Failed to enable 2FA')
  }
}

// DELETE: Disable TOTP 2FA
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return unauthorized('Invalid or expired session')

    await db.user.update({
      where: { id: userId },
      data: {
        totpSecret: null,
        totpEnabled: false,
        totpBackupCodes: null,
        totpVerifiedAt: null,
      },
    })

    await logAudit({
      userId,
      action: 'user.2fa.disable',
      entity: 'User',
      entityId: userId,
    })

    return success({ message: '2FA disabled' })
  } catch (err) {
    console.error('[2FA] Disable error:', err)
    return error('Failed to disable 2FA')
  }
}
