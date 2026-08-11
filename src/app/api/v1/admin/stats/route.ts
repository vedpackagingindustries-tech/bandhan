import { db } from '@/lib/db'
import { success, error } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

/** GET /api/v1/admin/stats — Real backend metrics for all modules */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (result.error) return result.error

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0)

    const [
      totalUsers, activeUsers, pendingApprovals,
      totalMatrimony, approvedMatrimony,
      totalJobs, activeJobs, totalApplications,
      totalBusiness, activeBusiness,
      totalDirectory, activeDirectory,
      totalReports, pendingReports,
      totalPayments, successPayments, revenue,
      todayRegistrations, todayMatrimony, todayJobs,
    ] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      db.user.count({ where: { status: 'PENDING_APPROVAL' } }),
      db.matrimonyProfile.count(),
      db.matrimonyProfile.count({ where: { status: 'APPROVED' } }),
      db.job.count(),
      db.job.count({ where: { status: 'ACTIVE' } }),
      db.jobApplication.count(),
      db.business.count(),
      db.business.count({ where: { status: 'ACTIVE' } }),
      db.directory.count(),
      db.directory.count({ where: { status: 'ACTIVE' } }),
      db.report.count(),
      db.report.count({ where: { status: 'PENDING' } }),
      db.payment.count(),
      db.payment.count({ where: { status: 'SUCCESS' } }),
      db.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
      db.user.count({ where: { createdAt: { gte: today } } }),
      db.matrimonyProfile.count({ where: { createdAt: { gte: today } } }),
      db.job.count({ where: { createdAt: { gte: today } } }),
    ])

    const monthlyRevenue = revenue._sum.amount || 0

    return success({
      users: { total: totalUsers, active: activeUsers, pending: pendingApprovals, today: todayRegistrations },
      matrimony: { total: totalMatrimony, approved: approvedMatrimony, today: todayMatrimony },
      jobs: { total: totalJobs, active: activeJobs, applications: totalApplications, today: todayJobs },
      business: { total: totalBusiness, active: activeBusiness },
      directory: { total: totalDirectory, active: activeDirectory },
      reports: { total: totalReports, pending: pendingReports },
      payments: { total: totalPayments, successful: successPayments, revenue: monthlyRevenue },
    })
  } catch (err) {
    console.error('[ADMIN STATS] Error:', err)
    return error('Failed to fetch stats')
  }
}
