import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { NextRequest } from 'next/server'

/**
 * GET /api/v1/membership — Get available membership plans
 * No auth required — public information
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ACTIVE'

    const plans = await db.membershipPlan.findMany({
      where: { status },
      orderBy: { sortOrder: 'asc' },
    })

    // If no plans in DB, return default plans
    if (plans.length === 0) {
      return success({
        items: [
          {
            name: 'FREE',
            displayName: 'Free',
            description: 'Basic access with limited features',
            price: 0,
            currency: 'INR',
            durationDays: 5,
            features: JSON.stringify(['Browse profiles', '5 contact requests/month', 'Basic search']),
            maxContacts: 5,
            maxPhotos: 3,
            priorityListing: false,
          },
          {
            name: 'PREMIUM',
            displayName: 'Premium',
            description: 'Enhanced access for serious users',
            price: 250,
            currency: 'INR',
            durationDays: 365,
            features: JSON.stringify(['All Free features', '30 contact requests/month', 'Advanced search', 'Priority listing', '10 photos', 'See contact details']),
            maxContacts: 30,
            maxPhotos: 10,
            priorityListing: true,
          },
          {
            name: 'ELITE',
            displayName: 'Elite',
            description: 'Premium experience with maximum benefits',
            price: 999,
            currency: 'INR',
            durationDays: 365,
            features: JSON.stringify(['All Premium features', '100 contact requests/month', 'Top priority listing', 'Unlimited photos', 'AI-powered matching', 'Dedicated support', 'Verified badge']),
            maxContacts: 100,
            maxPhotos: 50,
            priorityListing: true,
          },
        ],
      })
    }

    return success({ items: plans })
  } catch (err) {
    console.error('[MEMBERSHIP GET] Error:', err)
    return error('Failed to fetch membership plans')
  }
}
