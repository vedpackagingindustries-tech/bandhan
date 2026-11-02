import { db } from '@/lib/db'
import { success, error, serverError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requireAuth(request)
    if (result.error) return result.error

    const dir = await db.directory.findUnique({
      where: { id },
      include: { owner: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } }, district: { select: { id: true, name: true, nameHi: true } }, city: { select: { id: true, name: true, nameHi: true } } },
    })
    if (!dir || dir.status !== 'ACTIVE') return error('Directory listing not found', 404)

    await db.directory.update({ where: { id }, data: { viewsCount: { increment: 1 } } })
    return success({ ...dir, viewsCount: dir.viewsCount + 1 })
  } catch (err) {
    console.error('[DIRECTORY DETAIL] Error:', err)
    return serverError('Failed to fetch directory')
  }
}