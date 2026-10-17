
import { db } from '@/lib/db'
import { verifyPassword, checkRateLimit, generateSessionToken } from '@/lib/auth'
import { logAudit, logSecurityEvent } from '@/lib/audit'
import { success, error, unauthorized, getClientInfo } from '@/lib/api-response'
import { verifyTOTP } from '@/lib/totp'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, phone, password, totpCode } = body

    if (!password || (!email && !phone)) {
      return error('Email/phone and password are required')
    }

    const identifier = email || phone!
    const { ipAddress, userAgent } = getClientInfo(request)

    // Rate limiting (persistent via Vercel KV)
    const rateCheck = await checkRateLimit(`login:${identifier}`)
    if (!rateCheck.allowed) {
      return error('Too many login attempts. Please try again later.', 429)
    }

    // Find user
    const user = await db.user.findFirst({
      where: email ? { email } : { phone },
      include: { role: true, profile: true },
    })

    if (!user || !user.passwordHash) {
      await logSecurityEvent({
        eventType: 'LOGIN_FAILURE',
        description: `Login attempt for unregistered ${email ? 'email' : 'phone'}`,
        ipAddress,
        userAgent,
        severity: 'WARNING',
      })
      return unauthorized('Invalid credentials')
    }

    // Check account status
    if (user.status === 'BLOCKED') {
      await logSecurityEvent({
        userId: user.id,
        eventType: 'LOGIN_FAILURE',
        description: 'Blocked user attempted login',
        ipAddress,
        userAgent,
        severity: 'WARNING',
      })
      return error('Account is blocked. Contact support.', 403)
    }

    if (user.status === 'PENDING_APPROVAL') {
      return error('Account is pending approval. Please wait for admin verification.', 403)
    }

    if (user.status === 'REJECTED') {
      return error('Account registration was rejected. Contact support.', 403)
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return error('Account is temporarily locked. Please try again later.', 423)
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      const failedAttempts = user.failedLoginAttempts + 1
      const updateData: Record<string, unknown> = {
        failedLoginAttempts: failedAttempts,
      }

      // Lock after configured max failed attempts (default 5)
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5')
      if (failedAttempts >= maxAttempts) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 min
      }

      await db.user.update({ where: { id: user.id }, data: updateData })

      await logSecurityEvent({
        userId: user.id,
        eventType: 'LOGIN_FAILURE',
        description: `Failed login attempt ${failedAttempts}/${maxAttempts}`,
        ipAddress,
        userAgent,
        severity: failedAttempts >= maxAttempts - 1 ? 'CRITICAL' : 'WARNING',
      })

      return unauthorized('Invalid credentials')
    }

    // ─── TOTP 2FA Check ───
    // If user has TOTP enabled, require TOTP code
    if (user.totpEnabled && user.totpSecret) {
      if (!totpCode) {
        // Return a response indicating 2FA is required
        // Generate a temporary token for the 2FA step
        const tempToken = generateSessionToken()
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        })
        return success({
          requiresTwoFactor: true,
          tempToken, // Client sends this back with the TOTP code
          message: 'Two-factor authentication required',
        })
      }

      // Verify TOTP code
      const totpValid = verifyTOTP(user.totpSecret, totpCode)
      if (!totpValid) {
        // Check backup codes
        let backupValid = false
        if (user.totpBackupCodes) {
          try {
            const backupCodes: string[] = JSON.parse(user.totpBackupCodes)
            const codeIndex = backupCodes.indexOf(totpCode)
            if (codeIndex !== -1) {
              // Remove used backup code
              backupCodes.splice(codeIndex, 1)
              await db.user.update({
                where: { id: user.id },
                data: { totpBackupCodes: JSON.stringify(backupCodes) },
              })
              backupValid = true
            }
          } catch {}
        }

        if (!backupValid) {
          await logSecurityEvent({
            userId: user.id,
            eventType: 'TOTP_FAILURE',
            description: 'Invalid TOTP code or backup code',
            ipAddress,
            userAgent,
            severity: 'WARNING',
          })
          return error('Invalid authentication code', 401)
        }
      }

      // Mark TOTP as verified for this session
      await db.user.update({
        where: { id: user.id },
        data: { totpVerifiedAt: new Date() },
      })
    }

    // ─── Login Successful ───
    const sessionToken = generateSessionToken()
    const sessionDurationDays = parseInt(process.env.SESSION_DURATION_DAYS || '7')
    const sessionExpiry = new Date(Date.now() + sessionDurationDays * 24 * 60 * 60 * 1000)

    // Create session
    await db.userSession.create({
      data: {
        userId: user.id,
        token: sessionToken,
        device: userAgent.substring(0, 100),
        ipAddress,
        userAgent,
        expiresAt: sessionExpiry,
      },
    })

    // Update user
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
        deviceId: userAgent.substring(0, 100),
        ipAddress,
      },
    })

    // Log login history
    await db.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress,
        userAgent,
        device: userAgent.substring(0, 100),
        success: true,
      },
    })

    await logAudit({
      userId: user.id,
      action: 'user.login',
      entity: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    })

    return success({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        status: user.status,
        roleName: user.role?.name,
        membershipTier: user.membershipTier,
        registrationCategory: user.registrationCategory,
        mustChangePassword: user.mustChangePassword,
        totpEnabled: user.totpEnabled,
        profile: user.profile ? {
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          displayName: user.profile.displayName,
          profilePhotoUrl: user.profile.profilePhotoUrl,
        } : null,
      },
      token: sessionToken,
      expiresIn: `${sessionDurationDays}d`,
    })
  } catch (err) {
    console.error('[LOGIN] Error:', err)
    return error('Login failed. Please try again.')
  }
}
