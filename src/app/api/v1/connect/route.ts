import { db } from '@/lib/db'
import { success, error, serverError, getClientInfo } from '@/lib/api-response'
import { requireAuth, parsePagination, paginate } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notification'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

// ═══════════════════════════════════════════════════════════════
// CONNECT — Privacy-first connection requests.
// A logged-in user presses CONNECT on a listing; the request goes to
// the ADMIN (never directly to the listing owner). The listing owner's
// phone/email are NEVER exposed to the requester. The admin reviews the
// requester's profile, identifies the owner, and contacts the owner via
// WhatsApp/email. Statuses: PENDING → CONTACTED → ACCEPTED/REJECTED/CLOSED
// ═══════════════════════════════════════════════════════════════

const VALID_MODULES = ['MATRIMONY', 'BUSINESS', 'JOBS', 'DIRECTORY']

/** GET /api/v1/connect — my connection requests (requester view) */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const { page, limit, skip } = parsePagination(request.nextUrl.searchParams)
    const where: Prisma.ConnectionRequestWhereInput = { requesterId: auth.userId }

    const [items, total] = await Promise.all([
      db.connectionRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.connectionRequest.count({ where }),
    ])

    // Attach safe listing titles (no owner contact info)
    const withListings = await Promise.all(
      items.map(async (cr) => ({ ...cr, listingTitle: await getListingTitle(cr.module, cr.listingId) }))
    )

    return success({
      items: withListings.map(({ requesterPhone: _p, requesterName: _n, ...safe }) => safe),
      ...paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[CONNECT GET] Error:', err)
    return serverError('Failed to fetch connection requests')
  }
}

/** POST /api/v1/connect { module, listingId, message? } — create a request */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error
    const { auth } = result

    const body = await request.json()
    const { module, listingId, message } = body as { module?: string; listingId?: string; message?: string }

    if (!module || !VALID_MODULES.includes(module)) {
      return error('Valid module is required (MATRIMONY, BUSINESS, JOBS, DIRECTORY)')
    }
    if (!listingId) return error('Listing ID is required')

    // Listing must exist and be publicly visible
    const listing = await getListingOwner(module, listingId)
    if (!listing) return error('Listing not found or not available', 404)

    if (listing.ownerId === auth.userId) {
      return error('You cannot connect to your own listing')
    }

    // Duplicate prevention — one request per user per listing (unique constraint)
    const existing = await db.connectionRequest.findUnique({
      where: { module_listingId_requesterId: { module, listingId, requesterId: auth.userId } },
    })
    if (existing && existing.status !== 'REJECTED') {
      return error('आपने इस लिस्टिंग के लिए पहले ही अनुरोध भेज दिया है। कृपया प्रतीक्षा करें। (You already sent a request for this listing.)', 409)
    }
    if (existing && existing.status === 'REJECTED') {
      // Allow one respectful re-try after rejection only if the old one is closed out
      return error('आपका पिछला अनुरोध अस्वीकृत किया जा चुका है। (Your previous request for this listing was declined.)', 409)
    }

    // Spam guard: max 10 open (PENDING/CONTACTED) requests per user
    const openCount = await db.connectionRequest.count({
      where: { requesterId: auth.userId, status: { in: ['PENDING', 'CONTACTED'] } },
    })
    if (openCount >= 10) {
      return error('बहुत अधिक लंबित अनुरोध। कृपया प्रतीक्षा करें जब तक मौजूदा अनुरोध संसाधित न हो जाएं। (Too many pending requests. Please wait for existing ones to be processed.)', 429)
    }

    // Snapshot requester identity for ADMIN review (admin-only visibility)
    const requester = await db.user.findUnique({
      where: { id: auth.userId },
      select: { phone: true, profile: { select: { firstName: true, lastName: true } } },
    })
    const requesterName =
      [requester?.profile?.firstName, requester?.profile?.lastName].filter(Boolean).join(' ') || null

    const connection = await db.connectionRequest.create({
      data: {
        module,
        listingId,
        requesterId: auth.userId,
        ownerId: listing.ownerId,
        requesterName,
        requesterPhone: requester?.phone ?? null,
        message: message?.slice(0, 500) ?? null,
        status: 'PENDING',
      },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await logAudit({
      userId: auth.userId,
      action: 'connect.request_created',
      entity: 'ConnectionRequest',
      entityId: connection.id,
      details: { module, listingId },
      ipAddress,
      userAgent,
    })

    // Notify every active admin
    const admins = await db.user.findMany({
      where: { status: 'ACTIVE', role: { name: { in: ['SUPER_ADMIN', 'ADMIN'] } } },
      select: { id: true },
    })
    await Promise.all(
      admins.map((a) =>
        createNotification({
          userId: a.id,
          type: 'CONNECT_REQUEST',
          title: 'नया कनेक्ट अनुरोध (New CONNECT Request)',
          message: `${requesterName ?? 'A user'} requested connection to a ${module.toLowerCase()} listing. Review it in the admin panel.`,
          channel: 'IN_APP',
          data: { connectionId: connection.id, module, listingId },
        })
      )
    )

    // Confirmation to the requesting user
    await createNotification({
      userId: auth.userId,
      type: 'CONNECT_CONFIRMED',
      title: 'अनुरोध भेजा गया ✓ (Request Sent)',
      message: 'आपका कनेक्ट अनुरोध प्रशासक को भेज दिया गया है। स्वीकृति के बाद सूचित किया जाएगा। (Your CONNECT request has been sent to the administrator. You will be notified once it is reviewed.)',
      channel: 'IN_APP',
      data: { connectionId: connection.id },
    })

    return success({
      connectionId: connection.id,
      status: connection.status,
      message: 'कनेक्ट अनुरोध भेजा गया। प्रशासक जल्द ही संपर्क करेगा। (CONNECT request sent. The administrator will reach out soon.)',
    }, 201)
  } catch (err) {
    console.error('[CONNECT POST] Error:', err)
    return serverError('Failed to create connection request')
  }
}

async function getListingOwner(module: string, listingId: string): Promise<{ ownerId: string } | null> {
  switch (module) {
    case 'MATRIMONY': {
      const mp = await db.matrimonyProfile.findUnique({
        where: { id: listingId },
        select: { status: true, profile: { select: { userId: true } } },
      })
      if (!mp || mp.status !== 'APPROVED') return null
      return { ownerId: mp.profile.userId }
    }
    case 'BUSINESS': {
      const b = await db.business.findUnique({ where: { id: listingId }, select: { status: true, ownerId: true } })
      if (!b || b.status !== 'ACTIVE') return null
      return { ownerId: b.ownerId }
    }
    case 'JOBS': {
      const j = await db.job.findUnique({ where: { id: listingId }, select: { status: true, employerId: true } })
      if (!j || !['ACTIVE', 'OPEN'].includes(j.status)) return null
      return { ownerId: j.employerId }
    }
    case 'DIRECTORY': {
      const d = await db.directory.findUnique({ where: { id: listingId }, select: { status: true, ownerId: true } })
      if (!d || d.status !== 'ACTIVE') return null
      return { ownerId: d.ownerId }
    }
    default:
      return null
  }
}

async function getListingTitle(module: string, listingId: string): Promise<string | null> {
  switch (module) {
    case 'MATRIMONY': {
      const mp = await db.matrimonyProfile.findUnique({
        where: { id: listingId },
        select: { profile: { select: { firstName: true, lastName: true } } },
      })
      if (!mp) return null
      return [mp.profile.firstName, mp.profile.lastName].filter(Boolean).join(' ') || null
    }
    case 'BUSINESS': {
      const b = await db.business.findUnique({ where: { id: listingId }, select: { name: true } })
      return b?.name ?? null
    }
    case 'JOBS': {
      const j = await db.job.findUnique({ where: { id: listingId }, select: { title: true } })
      return j?.title ?? null
    }
    case 'DIRECTORY': {
      const d = await db.directory.findUnique({ where: { id: listingId }, select: { name: true } })
      return d?.name ?? null
    }
    default:
      return null
  }
}
