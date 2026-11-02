import { db } from '@/lib/db'
import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requireAuth(request)
    if (result.error) return result.error

    // PRIVACY: explicit field whitelist — owner's phone/email are NEVER returned.
    // Interested users press CONNECT; the admin mediates contact.
    const business = await db.business.findUnique({
      where: { id },
      select: {
        id: true, ownerId: true, name: true, description: true, category: true, type: true,
        address: true, website: true, gstNumber: true, workingHours: true, foundedYear: true,
        employeeCount: true, isVerified: true, isFeatured: true, featuredExpiry: true,
        status: true, viewsCount: true, createdAt: true,
        owner: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        district: { select: { id: true, name: true, nameHi: true } },
        city: { select: { id: true, name: true, nameHi: true } },
      },
    })
    if (!business || business.status !== 'ACTIVE') return error('Business not found', 404)

    await db.business.update({ where: { id }, data: { viewsCount: { increment: 1 } } })
    return success({
      ...business,
      phone: null,   // never exposed publicly — use CONNECT
      email: null,   // never exposed publicly — use CONNECT
      viewsCount: business.viewsCount + 1,
    })
  } catch (err) {
    console.error('[BUSINESS DETAIL] Error:', err)
    return serverError('Failed to fetch business')
  }
}
