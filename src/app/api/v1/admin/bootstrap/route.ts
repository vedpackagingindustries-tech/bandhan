// ═══════════════════════════════════════════════════════════
// ADMIN BOOTSTRAP — One-time first super admin claim
// NO hardcoded/predefined credentials anywhere.
// The FIRST person to claim becomes SUPER_ADMIN; endpoint
// permanently locks once an admin exists.
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { hashPassword } from '@/lib/auth'
import { logAudit, logSecurityEvent } from '@/lib/audit'
import { isValidEmail, isValidPassword } from '@/lib/validation'

/** Is any SUPER_ADMIN already present in the database? */
async function adminExists(): Promise<boolean> {
  const count = await db.user.count({
    where: { role: { name: 'SUPER_ADMIN' }, status: { not: 'DELETED' } },
  })
  return count > 0
}

// ─── GET: Check if bootstrap is available ───
export async function GET() {
  try {
    const exists = await adminExists()
    return success({
      bootstrapAvailable: !exists,
      message: exists
        ? 'Admin already exists. Bootstrap is locked.'
        : 'No admin exists. You can claim the Super Admin account.',
    })
  } catch {
    return error('Unable to check bootstrap status', 500)
  }
}

// ─── POST: Claim the first Super Admin account ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''

    // ─── 1. Lock check: only works when NO super admin exists ───
    if (await adminExists()) {
      await logSecurityEvent({
        eventType: 'BOOTSTRAP_BLOCKED',
        description: 'Bootstrap attempt while admin exists',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        severity: 'WARNING',
      })
      return error('Admin already exists. Bootstrap is permanently locked.', 403)
    }

    // ─── 2. Validate inputs ───
    if (!email || !password) {
      return error('Email and password are required', 400)
    }
    if (!isValidEmail(email)) {
      return error('Invalid email format', 400)
    }
    const pwdCheck = isValidPassword(password)
    if (!pwdCheck.valid) {
      return error(pwdCheck.errors.join('. '), 400)
    }
    if (confirmPassword && password !== confirmPassword) {
      return error('Passwords do not match', 400)
    }

    // ─── 3. Block disposable/common domains lightly (basic abuse guard) ───
    const disposableDomains = ['mailinator.com', 'tempmail', 'guerrillamail', '10minutemail', 'yopmail.com', 'trashmail']
    const domain = email.split('@')[1] || ''
    if (disposableDomains.some(d => domain.includes(d))) {
      return error('Disposable email addresses are not allowed', 400)
    }

    // ─── 4. Create role scaffold if missing (self-healing, no credentials involved) ───
    let superAdminRole = await db.role.findUnique({ where: { name: 'SUPER_ADMIN' } })
    if (!superAdminRole) {
      superAdminRole = await db.role.create({
        data: { name: 'SUPER_ADMIN', displayName: 'Super Admin', level: 6, description: 'Full system access' },
      })
    }

    // ─── 5. Email uniqueness check ───
    const existingUser = await db.user.findFirst({ where: { email, status: { not: 'DELETED' } } })
    if (existingUser) {
      return error('An account with this email already exists', 409)
    }

    // ─── 6. Create the FIRST super admin — credentials supplied by claimer ───
    const passwordHash = await hashPassword(password)
    const admin = await db.user.create({
      data: {
        email,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true, // bootstrap claimant is trusted as owner
        membershipTier: 'ELITE',
        registrationCategory: 'GENERAL',
        roleId: superAdminRole.id,
        acceptedTerms: true,
        mustChangePassword: false, // they chose their own password
      },
    })

    await db.profile.create({
      data: {
        userId: admin.id,
        firstName: firstName || 'Admin',
        lastName: '',
        displayName: firstName || 'Admin',
        gender: 'MALE',
      },
    })

    // ─── 7. Audit trail ───
    await logAudit({
      userId: admin.id,
      action: 'admin.bootstrap',
      entity: 'User',
      entityId: admin.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      details: { email, bootstrap: true, firstAdmin: true },
    })

    return success({
      message: 'Super Admin account created. You can now log in with your credentials.',
      email,
    }, 201)
  } catch (err) {
    console.error('[BOOTSTRAP] Error:', err)
    return error('Bootstrap failed', 500)
  }
}
