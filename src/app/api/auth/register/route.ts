
import { db } from '@/lib/db'
import { hashPassword, checkRateLimit } from '@/lib/auth'
import { sendOTP } from '@/lib/otp'
import { createNotification } from '@/lib/notification'
import { logAudit } from '@/lib/audit'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { NextRequest } from 'next/server'

const VALID_CATEGORIES = ['MATRIMONY', 'BUSINESS', 'JOB', 'DIRECTORY', 'GENERAL']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, phone, password, category, firstName, lastName, gotraId } = body

    // ─── Validation ───
    if (!email && !phone) {
      return error('Email or phone is required')
    }

    if (!password) {
      return error('Password is required')
    }

    if (password.length < 8) {
      return error('Password must be at least 8 characters')
    }

    if (category && !VALID_CATEGORIES.includes(category)) {
      return error('Invalid registration category')
    }

    const identifier = email || phone!

    // ─── Rate Limiting ───
    const rateCheck = checkRateLimit(`register:${identifier}`)
    if (!rateCheck.allowed) {
      return error('Too many registration attempts. Please try again later.', 429)
    }

    // ─── Check Uniqueness ───
    if (email) {
      const existing = await db.user.findFirst({ where: { email } })
      if (existing) return error('Email already registered')
    }

    if (phone) {
      const existingPhone = await db.user.findFirst({ where: { phone } })
      if (existingPhone) return error('Phone number already registered')
    }

    // ─── Validate gotraId against master if provided ───
    if (gotraId) {
      const gotra = await db.gotra.findUnique({ where: { id: gotraId } })
      if (!gotra) return error('Invalid Gotra selected', 400)
      if (!gotra.isActive) return error('Selected Gotra is not active', 400)
    }

    const { ipAddress, userAgent } = getClientInfo(request)

    // ─── Hash Password ───
    const passwordHash = await hashPassword(password)

    // ─── Determine Role ───
    // First user to register automatically becomes SUPER_ADMIN
    const existingUserCount = await db.user.count()
    const isFirstUser = existingUserCount === 0

    let role
    if (isFirstUser) {
      // Create SUPER_ADMIN role if needed, and assign to first user
      role = await db.role.upsert({
        where: { name: 'SUPER_ADMIN' },
        update: {},
        create: { name: 'SUPER_ADMIN', displayName: 'Super Admin', level: 100, description: 'First user — full system access' },
      })
    } else {
      // Ensure FREE_USER role exists
      role = await db.role.upsert({
        where: { name: 'FREE_USER' },
        update: {},
        create: { name: 'FREE_USER', displayName: 'Free User', level: 0, description: 'Standard free user' },
      })
    }

    // ─── Create User ───
    const user = await db.user.create({
      data: {
        email: email || null,
        phone: phone || null,
        passwordHash,
        status: isFirstUser ? 'ACTIVE' : 'PENDING_APPROVAL', // First user auto-approved
        membershipTier: isFirstUser ? 'ELITE' : 'FREE',
        registrationCategory: category || 'GENERAL',
        roleId: role.id,
        acceptedTerms: true,
        ipAddress,
        userAgent,
      },
    })

    // ─── Create Empty Profile ───
    await db.profile.create({
      data: {
        userId: user.id,
        firstName: firstName || null,
        lastName: lastName || null,
        ...(gotraId ? { gotraId } : {}),
      },
    })

    // ─── Send OTP Verification ───
    if (email) {
      await sendOTP({
        userId: user.id,
        identifier: email,
        type: 'REGISTRATION',
        method: 'EMAIL',
        ipAddress,
      })
    }
    if (phone) {
      await sendOTP({
        userId: user.id,
        identifier: phone,
        type: 'REGISTRATION',
        method: 'SMS',
        ipAddress,
      })
    }

    // ─── Log & Notify ───
    await logAudit({
      userId: user.id,
      action: 'user.register',
      entity: 'User',
      entityId: user.id,
      details: { category, email: !!email, phone: !!phone },
      ipAddress,
      userAgent,
    })

    // Notify super admins about new pending user
    const superAdmins = await db.user.findMany({
      where: { status: 'ACTIVE', role: { name: 'SUPER_ADMIN' } },
      select: { id: true },
    })
    for (const admin of superAdmins) {
      await createNotification({
        userId: admin.id,
        type: 'REGISTRATION',
        title: 'New User Registration',
        message: `A new user (${email || phone}) has registered and awaits approval.`,
      })
    }

    return success({
      userId: user.id,
      status: user.status,
      message: 'Registration successful. Please verify your OTP.',
      otpSentTo: email ? 'email' : 'phone',
    }, 201)
  } catch (err) {
    console.error('[REGISTER] Error:', err)
    return serverError('Registration failed. Please try again.')
  }
}
