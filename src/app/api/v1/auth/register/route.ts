
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

    // ─── Rate Limiting (persistent via Vercel KV) ───
    const rateCheck = await checkRateLimit(`register:${identifier}`)
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
    // AUTO-ACTIVATE: every self-registered account starts ACTIVE so the
    // member can log in immediately. A community platform cannot rely on an
    // approval gate that deadlocks when no admin has claimed the bootstrap
    // seat yet — admins can still BLOCK/DEACTIVATE any account from the
    // admin panel. OTP verification is tracked separately via
    // emailVerified/phoneVerified.
    const user = await db.user.create({
      data: {
        email: email || null,
        phone: phone || null,
        passwordHash,
        status: 'ACTIVE',
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

    // ─── Send OTP Verification (only when a REAL delivery provider exists) ───
    // Honest delivery: without RESEND_API_KEY (email) or MSG91_API_KEY (SMS),
    // no OTP is dispatched — frontend is told otpDelivered=false so it never
    // shows a fake "OTP sent" step. The OTP record with plaintext is kept in
    // DB for manual admin relay once those keys are configured.
    const emailDeliveryReady = !!process.env.RESEND_API_KEY
    const smsDeliveryReady = !!process.env.MSG91_API_KEY
    let otpDelivered = false
    if (email && emailDeliveryReady) {
      await sendOTP({
        userId: user.id,
        identifier: email,
        type: 'REGISTRATION',
        method: 'EMAIL',
        ipAddress,
      })
      otpDelivered = true
    }
    if (phone && smsDeliveryReady) {
      await sendOTP({
        userId: user.id,
        identifier: phone,
        type: 'REGISTRATION',
        method: 'SMS',
        ipAddress,
      })
      otpDelivered = true
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
        message: `A new user (${email || phone}) has registered${category ? ` under ${category}` : ''}.`,
      })
    }

    return success({
      userId: user.id,
      status: user.status,
      otpDelivered,
      message: otpDelivered
        ? 'Registration successful. Please verify your OTP.'
        : 'Registration successful. Your account is active — you can log in now.',
      otpSentTo: otpDelivered ? (email ? 'email' : 'phone') : null,
    }, 201)
  } catch (err) {
    console.error('[REGISTER] Error:', err)
    const message = err instanceof Error ? err.message : 'Registration failed. Please try again.'
    return serverError(message)
  }
}
