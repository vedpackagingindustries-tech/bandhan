// ═══════════════════════════════════════════════════════════
// ADMIN INITIALIZATION ENDPOINT
// POST: Apply RLS policies, verify database, run migrations
// Requires SUPER_ADMIN authentication
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { success, error, unauthorized } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'

// RLS SQL - applied via Prisma $executeRaw
const RLS_SQL = `
-- Enable RLS on all sensitive tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OtpVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Business" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Directory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MatrimonyProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginHistory" ENABLE ROW LEVEL SECURITY;
`

// Verify SUPER_ADMIN access
async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const session = await db.userSession.findUnique({
    where: { token },
    include: { user: { include: { role: true } } },
  })
  if (!session || session.expiresAt < new Date()) return null
  if (session.user.status !== 'ACTIVE') return null
  if (session.user.role?.name !== 'SUPER_ADMIN') return null
  return session.user
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifySuperAdmin(request)
    if (!admin) return unauthorized('SUPER_ADMIN access required')

    const body = await request.json().catch(() => ({}))
    const action = body.action || 'all'

    const results: Record<string, string> = {}

    // 1. Apply RLS policies
    if (action === 'all' || action === 'rls') {
      try {
        // Execute RLS statements one by one
        const tables = [
          'User', 'Profile', 'UserSession', 'OtpVerification', 'AuditLog',
          'SecurityEvent', 'Notification', 'ContactRequest', 'Membership',
          'Payment', 'Media', 'Job', 'JobApplication', 'Business',
          'Directory', 'MatrimonyProfile', 'MatchScore', 'LoginHistory'
        ]

        for (const table of tables) {
          await db.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
        }

        // Apply public read policies
        const publicPolicies = [
          { name: 'public_read_active_jobs', table: 'Job', condition: "status = 'ACTIVE'" },
          { name: 'public_read_active_businesses', table: 'Business', condition: "status = 'ACTIVE'" },
          { name: 'public_read_active_directories', table: 'Directory', condition: "status = 'ACTIVE'" },
        ]

        for (const policy of publicPolicies) {
          try {
            await db.$executeRawUnsafe(
              `CREATE POLICY "${policy.name}" ON "${policy.table}" FOR SELECT USING (${policy.condition})`
            )
          } catch (e: unknown) {
            // Policy may already exist - that's OK
            const msg = e instanceof Error ? e.message : String(e)
            if (!msg.includes('already exists')) {
              results[`policy_${policy.name}`] = `WARN: ${msg}`
            } else {
              results[`policy_${policy.name}`] = 'EXISTS (OK)'
            }
          }
        }

        results.rls = 'APPLIED - 18 tables enabled'
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        results.rls = `ERROR: ${msg}`
      }
    }

    // 2. Verify database connectivity
    if (action === 'all' || action === 'verify') {
      try {
        await db.$queryRaw`SELECT 1`
        results.database = 'CONNECTED'
        
        // Count tables
        const tables = await db.$queryRaw<Array<{tablename: string}>>`
          SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
        `
        results.tables = `${tables.length} tables found`
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        results.database = `ERROR: ${msg}`
      }
    }

    // 3. Check environment variables
    if (action === 'all' || action === 'env') {
      const required = [
        'DATABASE_URL', 'DIRECT_URL', 'OTP_HASH_SECRET',
        'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ]
      const optional = [
        'KV_REST_API_URL', 'BLOB_READ_WRITE_TOKEN',
        'RESEND_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
      ]

      const present: string[] = []
      const missing: string[] = []

      for (const key of required) {
        if (process.env[key]) present.push(key)
        else missing.push(key)
      }

      const optionalPresent: string[] = []
      for (const key of optional) {
        if (process.env[key]) optionalPresent.push(key)
      }

      results.requiredEnv = `${present.length}/${required.length} present`
      results.missingEnv = missing.length > 0 ? missing.join(', ') : 'NONE'
      results.optionalEnv = optionalPresent.join(', ') || 'NONE'
    }

    // Audit log
    await logAudit({
      userId: admin.id,
      action: 'admin.init',
      entity: 'System',
      entityId: 'rls-policies',
      details: { action, results },
    })

    return success({ action, results, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[ADMIN INIT] Error:', err)
    return error('Initialization failed')
  }
}
