'use server'

import { db } from '@/lib/db'
import { verifyPassword, checkRateLimit, generateSessionToken } from '@/lib/auth'
import { logAudit, logSecurityEvent } from '@/lib/audit'
import { success, error, unauthorized, getClientInfo } from '@/lib/api-response'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, phone, password } = body

    if (!password || (!email && !phone)) {
      return error('Email/phone and password are required')
    }

    const identifier = email || phone!
    const { ipAddress, userAgent } = getClientInfo(request)

    // Rate limiting
    const rateCheck = checkRateLimit(`login:${identifier}`)
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

      // Lock after 5 failed attempts
      if (failedAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 min
      }

      await db.user.update({ where: { id: user.id }, data: updateData })

      await logSecurityEvent({
        userId: user.id,
        eventType: 'LOGIN_FAILURE',
        description: `Failed login attempt ${failedAttempts}/5`,
        ipAddress,
        userAgent,
        severity: failedAttempts >= 4 ? 'CRITICAL' : 'WARNING',
      })

      return unauthorized('Invalid credentials')
    }

    // ─── Login Successful ───
    const sessionToken = generateSessionToken()
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

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
        profile: user.profile ? {
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          displayName: user.profile.displayName,
          profilePhotoUrl: user.profile.profilePhotoUrl,
        } : null,
      },
      token: sessionToken,
      expiresIn: '30d',
    })
  } catch (err) {
    console.error('[LOGIN] Error:', err)
    return error('Login failed. Please try again.')
  }
}