import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════
// GET — List membership plans with user stats + revenue
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const plans = await db.membershipPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    // For each plan, get active membership count and revenue
    const plansWithStats = await Promise.all(
      plans.map(async (plan) => {
        const [activeMemberships, revenueAgg] = await Promise.all([
          db.membership.count({
            where: { tier: plan.name, status: 'ACTIVE' },
          }),
          db.payment.aggregate({
            where: {
              purpose: 'MEMBERSHIP',
              status: 'SUCCESS',
              membershipTier: plan.name,
            },
            _sum: { amount: true },
          }),
        ])

        return {
          id: plan.id,
          name: plan.name,
          displayName: plan.displayName,
          description: plan.description,
          price: plan.price,
          currency: plan.currency,
          durationDays: plan.durationDays,
          features: plan.features,
          maxContacts: plan.maxContacts,
          maxPhotos: plan.maxPhotos,
          priorityListing: plan.priorityListing,
          status: plan.status,
          sortOrder: plan.sortOrder,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          activeMemberships,
          totalRevenue: revenueAgg._sum.amount ?? 0,
        }
      })
    )

    return success({ plans: plansWithStats })
  } catch (err) {
    console.error('[MEMBERSHIP_PLANS_LIST]', err)
    return serverError()
  }
}

// ═══════════════════════════════════════════════════════════
// POST — Create or update membership plan
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { auth, error: err } = await requireSuperAdmin(request)
    if (err) return err

    const body = await request.json()
    const {
      id,
      name,
      displayName,
      description,
      price,
      currency,
      durationDays,
      features,
      maxContacts,
      maxPhotos,
      priorityListing,
      status,
      sortOrder,
    } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return error('name is required')
    }
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return error('displayName is required')
    }
    if (price === undefined || price === null || typeof price !== 'number' || price < 0) {
      return error('price must be a non-negative number')
    }
    if (!durationDays || typeof durationDays !== 'number' || durationDays <= 0) {
      return error('durationDays must be a positive number')
    }
    if (features !== undefined && features !== null) {
      if (typeof features === 'string') {
        try {
          JSON.parse(features)
        } catch {
          return error('features must be a valid JSON array string')
        }
      } else if (Array.isArray(features)) {
        // Will be stringified below
      } else {
        return error('features must be a JSON array')
      }
    }

    const { ipAddress, userAgent } = getClientInfo(request)

    // UPDATE existing plan
    if (id) {
      const existing = await db.membershipPlan.findUnique({ where: { id } })
      if (!existing) return error('Plan not found', 404)

      // Check name uniqueness if name is being changed
      if (name.trim() !== existing.name) {
        const nameTaken = await db.membershipPlan.findUnique({ where: { name: name.trim() } })
        if (nameTaken) return error('A plan with this name already exists')
      }

      const plan = await db.membershipPlan.update({
        where: { id },
        data: {
          name: name.trim(),
          displayName: displayName.trim(),
          description: description ?? null,
          price,
          currency: currency || 'INR',
          durationDays,
          features: features ? (typeof features === 'string' ? features : JSON.stringify(features)) : existing.features,
          maxContacts: typeof maxContacts === 'number' ? maxContacts : existing.maxContacts,
          maxPhotos: typeof maxPhotos === 'number' ? maxPhotos : existing.maxPhotos,
          priorityListing: typeof priorityListing === 'boolean' ? priorityListing : existing.priorityListing,
          status: status || existing.status,
          sortOrder: typeof sortOrder === 'number' ? sortOrder : existing.sortOrder,
        },
      })

      await logAudit({
        userId: auth.user.id,
        action: 'admin.membership_plan_update',
        entity: 'MembershipPlan',
        entityId: id,
        details: { name: plan.name, changedFields: Object.keys(body) },
        ipAddress,
        userAgent,
      })

      return success({ plan })
    }

    // CREATE new plan
    const nameTaken = await db.membershipPlan.findUnique({ where: { name: name.trim() } })
    if (nameTaken) return error('A plan with this name already exists')

    const plan = await db.membershipPlan.create({
      data: {
        name: name.trim(),
        displayName: displayName.trim(),
        description: description || null,
        price,
        currency: currency || 'INR',
        durationDays,
        features: features ? (typeof features === 'string' ? features : JSON.stringify(features)) : '[]',
        maxContacts: typeof maxContacts === 'number' ? maxContacts : 10,
        maxPhotos: typeof maxPhotos === 'number' ? maxPhotos : 5,
        priorityListing: typeof priorityListing === 'boolean' ? priorityListing : false,
        status: status || 'ACTIVE',
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      },
    })

    await logAudit({
      userId: auth.user.id,
      action: 'admin.membership_plan_create',
      entity: 'MembershipPlan',
      entityId: plan.id,
      details: { name: plan.name, price, durationDays },
      ipAddress,
      userAgent,
    })

    return success({ plan }, 201)
  } catch (err) {
    console.error('[MEMBERSHIP_PLAN_SAVE]', err)
    return serverError()
  }
}
