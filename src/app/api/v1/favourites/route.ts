import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

// ═══════════════════════════════════════════════════════════════
// FAVOURITES — Max 5 active favourites per user per category.
// The 5-item limit is enforced HERE (server side), not just in UI.
// Separate lists: MATRIMONY, BUSINESS, JOBS
// ═══════════════════════════════════════════════════════════════

const VALID_MODULES = ['MATRIMONY', 'BUSINESS', 'JOBS']
export const MAX_FAVOURITES_PER_MODULE = 5

// GET /api/v1/favourites?module=MATRIMONY — list my favourites (with listing previews)
export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const sp = request.nextUrl.searchParams
    const moduleFilter = sp.get('module')
    const { page, limit, skip } = parsePagination(sp)

    const where: Prisma.FavouriteWhereInput = { userId: auth.userId }
    if (moduleFilter && VALID_MODULES.includes(moduleFilter)) where.module = moduleFilter

    const [favs, total] = await Promise.all([
      db.favourite.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.favourite.count({ where }),
    ])

    // Attach public listing previews (NEVER private contact info)
    const [matrimonyIds, businessIds, jobsIds] = [
      favs.filter((f) => f.module === 'MATRIMONY').map((f) => f.listingId),
      favs.filter((f) => f.module === 'BUSINESS').map((f) => f.listingId),
      favs.filter((f) => f.module === 'JOBS').map((f) => f.listingId),
    ]

    const [profiles, businesses, jobs] = await Promise.all([
      matrimonyIds.length
        ? db.matrimonyProfile.findMany({
            where: { id: { in: matrimonyIds } },
            select: {
              id: true, gender: true, dateOfBirth: true, occupation: true, education: true,
              workingCity: true, status: true, isFeatured: true,
              profile: { select: { firstName: true, lastName: true, displayName: true, city: true, profilePhotoUrl: true } },
            },
          })
        : Promise.resolve([] as Array<{ id: string; gender: string; dateOfBirth: string | null; occupation: string | null; education: string | null; workingCity: string | null; status: string; isFeatured: boolean; profile: { firstName: string | null; lastName: string | null; displayName: string | null; city: string | null; profilePhotoUrl: string | null } }>),
      businessIds.length
        ? db.business.findMany({
            where: { id: { in: businessIds } },
            select: { id: true, name: true, category: true, address: true, status: true, isFeatured: true, featuredExpiry: true, city: { select: { name: true, nameHi: true } } },
          })
        : Promise.resolve([] as Array<{ id: string; name: string; category: string | null; address: string | null; status: string; isFeatured: boolean; featuredExpiry: Date | null; city: { name: string; nameHi: string | null } | null }>),
      jobsIds.length
        ? db.job.findMany({
            where: { id: { in: jobsIds } },
            select: { id: true, title: true, location: true, type: true, salaryMin: true, salaryMax: true, status: true, isFeatured: true, featuredExpiry: true, expiresAt: true },
          })
        : Promise.resolve([] as Array<{ id: string; title: string; location: string | null; type: string | null; salaryMin: string | null; salaryMax: string | null; status: string; isFeatured: boolean; featuredExpiry: Date | null; expiresAt: Date | null }>),
    ])

    const profileMap = new Map(profiles.map((p) => [p.id, p]))
    const businessMap = new Map(businesses.map((b) => [b.id, b]))
    const jobMap = new Map(jobs.map((j) => [j.id, j]))

    const items = favs.map((f) => ({
      id: f.id,
      module: f.module,
      listingId: f.listingId,
      createdAt: f.createdAt,
      listing:
        f.module === 'MATRIMONY' ? profileMap.get(f.listingId) ?? null :
        f.module === 'BUSINESS' ? businessMap.get(f.listingId) ?? null :
        f.module === 'JOBS' ? jobMap.get(f.listingId) ?? null : null,
    }))

    // Per-module counts for the limit display
    const counts = await db.favourite.groupBy({
      by: ['module'],
      where: { userId: auth.userId },
      _count: { module: true },
    })

    return success({
      items,
      limits: { max: MAX_FAVOURITES_PER_MODULE },
      counts: Object.fromEntries(counts.map((c) => [c.module, c._count.module])),
      ...paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[FAVOURITES GET] Error:', err)
    return serverError('Failed to fetch favourites')
  }
}

// POST /api/v1/favourites { module, listingId } — add favourite (max 5 enforced)
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { module, listingId } = body as { module?: string; listingId?: string }

    if (!module || !VALID_MODULES.includes(module)) {
      return error('Valid module is required (MATRIMONY, BUSINESS, JOBS)')
    }
    if (!listingId) return error('Listing ID is required')

    // Listing must exist and be publicly visible
    const exists = await listingVisible(module, listingId)
    if (!exists) return error('Listing not found or not available', 404)

    // Duplicate check
    const existing = await db.favourite.findUnique({
      where: { userId_module_listingId: { userId: auth.userId, module, listingId } },
    })
    if (existing) {
      return error('This listing is already in your favourites', 409)
    }

    // ── MAX 5 ENFORCEMENT (server-side, per category) ──
    const count = await db.favourite.count({ where: { userId: auth.userId, module } })
    if (count >= MAX_FAVOURITES_PER_MODULE) {
      return error(
        `आपकी ${moduleLabel(module)} पसंदीदा सूची भर गई है — अधिकतम ${MAX_FAVOURITES_PER_MODULE} अनुमत हैं। कृपया पहले कोई हटाएं। (Your ${moduleLabel(module)} favourites list is full — maximum ${MAX_FAVOURITES_PER_MODULE} allowed. Remove one first.)`,
        429
      )
    }

    const favourite = await db.favourite.create({
      data: { userId: auth.userId, module, listingId },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'favourite.added',
      entity: 'Favourite',
      entityId: favourite.id,
      details: { module, listingId },
      ipAddress,
      userAgent,
    })

    return success({
      favourite,
      count: count + 1,
      max: MAX_FAVOURITES_PER_MODULE,
      message: module === 'MATRIMONY' ? 'पसंदीदा में जोड़ा गया' : 'Added to favourites',
    }, 201)
  } catch (err) {
    console.error('[FAVOURITES POST] Error:', err)
    return serverError('Failed to add favourite')
  }
}

// DELETE /api/v1/favourites?id=<favouriteId> OR ?module=&listingId=
export async function DELETE(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const sp = request.nextUrl.searchParams
    const id = sp.get('id')
    const module = sp.get('module')
    const listingId = sp.get('listingId')

    if (id) {
      const fav = await db.favourite.findUnique({ where: { id } })
      if (!fav) return error('Favourite not found', 404)
      if (fav.userId !== auth.userId) return error('Not authorized', 403)
      await db.favourite.delete({ where: { id } })
      return success({ removed: id, message: 'Removed from favourites' })
    }

    if (module && listingId && VALID_MODULES.includes(module)) {
      const deleted = await db.favourite.deleteMany({
        where: { userId: auth.userId, module, listingId },
      })
      if (deleted.count === 0) return error('Favourite not found', 404)
      return success({ removedListing: listingId, message: 'Removed from favourites' })
    }

    return error('Provide favourite id, or module + listingId')
  } catch (err) {
    console.error('[FAVOURITES DELETE] Error:', err)
    return serverError('Failed to remove favourite')
  }
}

async function listingVisible(module: string, listingId: string): Promise<boolean> {
  switch (module) {
    case 'MATRIMONY': {
      const mp = await db.matrimonyProfile.findUnique({ where: { id: listingId }, select: { status: true } })
      return mp?.status === 'APPROVED'
    }
    case 'BUSINESS': {
      const b = await db.business.findUnique({ where: { id: listingId }, select: { status: true } })
      return b?.status === 'ACTIVE'
    }
    case 'JOBS': {
      const j = await db.job.findUnique({ where: { id: listingId }, select: { status: true } })
      return ['ACTIVE', 'OPEN'].includes(j?.status ?? '')
    }
    default:
      return false
  }
}

function moduleLabel(module: string): string {
  return module.charAt(0) + module.slice(1).toLowerCase()
}
