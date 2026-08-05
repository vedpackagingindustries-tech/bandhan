'use server'

import { db } from '@/lib/db'
import { unauthorized, success, error, getClientInfo } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({ where: { token } })
    if (!session || session.expiresAt < new Date()) return unauthorized()

    const profile = await db.profile.findUnique({
      where: { userId: session.userId },
      include: {
        user: {
          select: { email: true, phone: true, status: true, membershipTier: true, registrationCategory: true, role: { select: { name: true, displayName: true } } } },
      },
    })

    if (!profile) return error('Profile not found', 404)
    return success(profile)
  } catch (err) {
    console.error('[PROFILE GET] Error:', err)
    return error('Failed to fetch profile')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return unauthorized()

    const session = await db.userSession.findUnique({ where: { token } })
    if (!session || session.expiresAt < new Date()) return unauthorized()

    const body = await request.json()
    const { ipAddress, userAgent } = getClientInfo(request)

    // Only allow updating profile fields, never userId or user relations
    const allowedFields = [
      'firstName', 'lastName', 'displayName', 'gender', 'dateOfBirth',
      'maritalStatus', 'gotra', 'address', 'city', 'state', 'country', 'pincode',
      'occupation', 'education', 'annualIncome', 'companyName', 'designation',
      'height', 'familyType', 'fatherName', 'motherName', 'familyCity', 'aboutFamily',
      'businessName', 'businessCategory', 'businessType', 'businessAddress',
      'businessCity', 'businessState', 'businessPincode', 'businessPhone',
      'businessEmail', 'businessWebsite', 'gstNumber', 'businessDescription',
      'businessFounded', 'employeeCount',
      'organizationName', 'organizationType', 'organizationRole', 'memberCount', 'organizationDesc',
      'phoneVisible', 'emailVisible', 'profileVisible', 'contactPermission',
      'bio', 'profilePhotoUrl', 'coverPhotoUrl',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const profile = await db.profile.update({
      where: { userId: session.userId },
      data: updateData,
    })

    await logAudit({
      userId: session.userId,
      action: 'profile.update',
      entity: 'Profile',
      entityId: profile.id,
      details: { updatedFields: Object.keys(updateData) },
      ipAddress,
      userAgent,
    })

    return success(profile)
  } catch (err) {
    console.error('[PROFILE UPDATE] Error:', err)
    return error('Failed to update profile')
  }
}