import { db } from '@/lib/db'
import { success, error, serverError } from '@/lib/api-response'
import { requireAdmin, parsePagination, paginate } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/admin/connect — All connection requests (ADMIN+)
// Admin sees: requester profile snapshot, listing reference, status.
// WhatsApp click-to-chat URLs are generated HERE for the admin.
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const sp = request.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)
    const status = sp.get('status')
    const module = sp.get('module')
    const q = sp.get('q')?.trim()

    const where: Prisma.ConnectionRequestWhereInput = {}
    if (status && status !== 'ALL') where.status = status
    if (module && module !== 'ALL') where.module = module
    if (q) {
      where.OR = [
        { requesterName: { contains: q, mode: 'insensitive' } },
        { requesterPhone: { contains: q } },
        { listingId: { contains: q } },
      ]
    }

    const [items, total] = await Promise.all([
      db.connectionRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          requester: {
            select: {
              id: true, phone: true, email: true, membershipTier: true,
              createdAt: true,
              profile: { select: { firstName: true, lastName: true, city: true, occupation: true, gender: true, profilePhotoUrl: true } },
            },
          },
        },
      }),
      db.connectionRequest.count({ where }),
    ])

    // Attach listing titles + admin WhatsApp click-to-chat links
    const enriched = await Promise.all(
      items.map(async (cr) => {
        const listingTitle = await getListingTitle(cr.module, cr.listingId)
        const ownerContact = await getOwnerContact(cr.module, cr.listingId)
        return {
          ...cr,
          listingTitle,
          // Owner identity & contact — ADMIN ONLY, never shown to requesters/public
          owner: ownerContact,
          whatsappLinks: {
            // Admin → listing owner (prefilled Hindi message)
            toOwner: ownerContact?.phone
              ? buildWhatsAppLink(
                  ownerContact.phone,
                  `नमस्ते ${ownerContact.name ?? ''}, बंधन (Bandhan) प्लेटफॉर्म पर आपकी "${listingTitle ?? 'लिस्टिंग'}" लिस्टिंग में किसी की रुचि (interest) दर्शाई गई है। कृपया विवरण के लिए बंधन प्रशासक से संपर्क करें। धन्यवाद!`
                )
              : null,
            // Admin → requester (prefilled Hindi message)
            toRequester: cr.requesterPhone
              ? buildWhatsAppLink(
                  cr.requesterPhone,
                  `नमस्ते ${cr.requesterName ?? ''}, आपका बंधन (Bandhan) कनेक्ट अनुरोध अपडेट किया गया है। कृपया ऐप में लॉगिन करके स्थिति देखें। धन्यवाद!`
                )
              : null,
          },
        }
      })
    )

    const statusCounts = await db.connectionRequest.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    return success({
      items: enriched,
      counts: Object.fromEntries(statusCounts.map((c) => [c.status, c._count.status])),
      ...paginate(page, limit, total),
    })
  } catch (err) {
    console.error('[ADMIN CONNECT GET] Error:', err)
    return serverError('Failed to fetch connection requests')
  }
}

function buildWhatsAppLink(phone: string, message: string): string {
  // Normalize to international format for wa.me (strip non-digits, ensure country code)
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10) digits = '91' + digits
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
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

async function getOwnerContact(module: string, listingId: string): Promise<{ userId: string; name: string | null; phone: string | null; email: string | null } | null> {
  let ownerId: string | null = null
  if (module === 'MATRIMONY') {
    const mp = await db.matrimonyProfile.findUnique({ where: { id: listingId }, select: { profile: { select: { userId: true } } } })
    ownerId = mp?.profile.userId ?? null
  } else if (module === 'BUSINESS') {
    const b = await db.business.findUnique({ where: { id: listingId }, select: { ownerId: true } })
    ownerId = b?.ownerId ?? null
  } else if (module === 'JOBS') {
    const j = await db.job.findUnique({ where: { id: listingId }, select: { employerId: true } })
    ownerId = j?.employerId ?? null
  } else if (module === 'DIRECTORY') {
    const d = await db.directory.findUnique({ where: { id: listingId }, select: { ownerId: true } })
    ownerId = d?.ownerId ?? null
  }
  if (!ownerId) return null
  const user = await db.user.findUnique({
    where: { id: ownerId },
    select: { id: true, phone: true, email: true, profile: { select: { firstName: true, lastName: true } } },
  })
  if (!user) return null
  return {
    userId: user.id,
    name: [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ') || null,
    phone: user.phone,
    email: user.email,
  }
}
