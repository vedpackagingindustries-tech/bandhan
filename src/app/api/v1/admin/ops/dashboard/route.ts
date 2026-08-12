import { db } from '@/lib/db'
import { success, serverError } from '@/lib/api-response'
import { requireSuperAdmin } from '@/lib/auth-middleware'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const result = await requireSuperAdmin(request)
    if (result.error) return result.error

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      // MATRIMONY METRICS
      matTotal,
      matPending,
      matApproved,
      matRejected,
      matBlocked,
      matDraft,
      matFeatured,
      matMale,
      matFemale,

      // BUSINESS METRICS
      bizTotal,
      bizPending,
      bizActive,
      bizRejected,
      bizBlocked,
      bizVerified,
      bizFeatured,

      // JOBS METRICS
      jobTotal,
      jobActive,
      jobPending,
      jobClosed,
      jobExpired,
      jobRejected,
      jobApplicationsAgg,
      jobEmployersAgg,
      jobFeatured,

      // DIRECTORY METRICS
      dirTotal,
      dirPending,
      dirActive,
      dirRejected,
      dirVerified,
      dirFeatured,

      // REVENUE METRICS
      revTotal,
      revMembership,
      revBusiness,
      revJob,
      revAd,
      revPending,
      revFailed,
      revRefunded,
      revSuccess,

      // AI METRICS
      aiTotal,
      aiCompleted,
      aiFailed,
      aiPending,
      aiCostAgg,
      aiActiveProviders,
      aiModeration,
      aiMatch,
      aiAssistant,

      // USER METRICS
      userTotal,
      userActive,
      userPending,
      userBlocked,
      userRejected,
      userPremium,
      userElite,

      // REPORTS METRICS
      reportTotal,
      reportPending,
      reportResolved,
      reportDismissed,

      // NOTIFICATION METRICS
      notifTotal,
      notifUnread,

      // ADVERTISEMENT METRICS
      adActiveCampaigns,
      adImpressionsAgg,
      adClicksAgg,

      // SECURITY METRICS
      secRecentEvents,
      secCriticalEvents,
      secLockedUsers,

      // GOTRA METRICS
      gotraTotal,
      gotraActive,
    ] = await Promise.all([
      // ── MATRIMONY ──
      db.matrimonyProfile.count(),
      db.matrimonyProfile.count({ where: { status: 'PENDING_APPROVAL' } }),
      db.matrimonyProfile.count({ where: { status: 'APPROVED' } }),
      db.matrimonyProfile.count({ where: { status: 'REJECTED' } }),
      db.matrimonyProfile.count({ where: { status: 'BLOCKED' } }),
      db.matrimonyProfile.count({ where: { status: 'DRAFT' } }),
      db.matrimonyProfile.count({
        where: { isFeatured: true, featuredExpiry: { gt: now } },
      }),
      db.matrimonyProfile.count({ where: { gender: 'MALE' } }),
      db.matrimonyProfile.count({ where: { gender: 'FEMALE' } }),

      // ── BUSINESS ──
      db.business.count(),
      db.business.count({ where: { status: 'PENDING' } }),
      db.business.count({ where: { status: 'ACTIVE' } }),
      db.business.count({ where: { status: 'REJECTED' } }),
      db.business.count({ where: { status: 'BLOCKED' } }),
      db.business.count({ where: { isVerified: true } }),
      db.business.count({ where: { isFeatured: true } }),

      // ── JOBS ──
      db.job.count(),
      db.job.count({ where: { status: 'ACTIVE' } }),
      db.job.count({ where: { status: 'PENDING' } }),
      db.job.count({ where: { status: 'CLOSED' } }),
      db.job.count({ where: { status: 'EXPIRED' } }),
      db.job.count({ where: { status: 'REJECTED' } }),
      db.job.aggregate({
        _sum: { applicationsCount: true },
      }),
      db.job.groupBy({ by: ['employerId'] }),
      db.job.count({ where: { isFeatured: true } }),

      // ── DIRECTORY ──
      db.directory.count(),
      db.directory.count({ where: { status: 'PENDING' } }),
      db.directory.count({ where: { status: 'ACTIVE' } }),
      db.directory.count({ where: { status: 'REJECTED' } }),
      db.directory.count({ where: { isVerified: true } }),
      db.directory.count({ where: { isFeatured: true } }),

      // ── REVENUE ──
      db.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: { purpose: 'MEMBERSHIP', status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: { purpose: 'BUSINESS_FEATURED', status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: { purpose: 'JOB_FEATURED', status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: { purpose: 'ADVERTISEMENT', status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      db.payment.count({ where: { status: { in: ['INITIATED', 'PENDING'] } } }),
      db.payment.count({ where: { status: 'FAILED' } }),
      db.payment.count({ where: { status: 'REFUNDED' } }),
      db.payment.count({ where: { status: 'SUCCESS' } }),

      // ── AI ──
      db.aIRequest.count(),
      db.aIRequest.count({ where: { status: 'COMPLETED' } }),
      db.aIRequest.count({ where: { status: 'FAILED' } }),
      db.aIRequest.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      db.aIRequest.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { costUsd: true },
      }),
      db.aIProviderConfig.count({ where: { enabled: true } }),
      db.aIRequest.count({ where: { operation: 'MODERATE' } }),
      db.aIRequest.count({ where: { operation: 'MATCH' } }),
      db.aIRequest.count({ where: { operation: 'ASSIST' } }),

      // ── USERS ──
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      db.user.count({ where: { status: 'PENDING_APPROVAL', deletedAt: null } }),
      db.user.count({ where: { status: 'BLOCKED', deletedAt: null } }),
      db.user.count({ where: { status: 'REJECTED', deletedAt: null } }),
      db.user.count({ where: { membershipTier: 'PREMIUM', deletedAt: null } }),
      db.user.count({ where: { membershipTier: 'ELITE', deletedAt: null } }),

      // ── REPORTS ──
      db.report.count(),
      db.report.count({ where: { status: 'PENDING' } }),
      db.report.count({ where: { status: 'RESOLVED' } }),
      db.report.count({ where: { status: 'DISMISSED' } }),

      // ── NOTIFICATIONS ──
      db.notification.count(),
      db.notification.count({ where: { read: false } }),

      // ── ADVERTISEMENTS ──
      db.adCampaign.count({ where: { status: 'ACTIVE' } }),
      db.adCampaign.aggregate({
        _sum: { impressions: true },
      }),
      db.adCampaign.aggregate({
        _sum: { clicks: true },
      }),

      // ── SECURITY ──
      db.securityEvent.count({ where: { createdAt: { gt: twentyFourHoursAgo } } }),
      db.securityEvent.count({
        where: { severity: 'CRITICAL', createdAt: { gt: sevenDaysAgo } },
      }),
      db.user.count({ where: { lockedUntil: { gt: now } } }),

      // ── GOTRA ──
      db.gotra.count(),
      db.gotra.count({ where: { isActive: true } }),
    ])

    return success({
      matrimony: {
        totalProfiles: matTotal,
        pendingApproval: matPending,
        approved: matApproved,
        rejected: matRejected,
        blocked: matBlocked,
        draft: matDraft,
        featured: matFeatured,
        male: matMale,
        female: matFemale,
      },
      business: {
        total: bizTotal,
        pending: bizPending,
        active: bizActive,
        rejected: bizRejected,
        blocked: bizBlocked,
        verified: bizVerified,
        featured: bizFeatured,
      },
      jobs: {
        total: jobTotal,
        active: jobActive,
        pending: jobPending,
        closed: jobClosed,
        expired: jobExpired,
        rejected: jobRejected,
        totalApplications: jobApplicationsAgg._sum.applicationsCount ?? 0,
        employers: jobEmployersAgg.length,
        featured: jobFeatured,
      },
      directory: {
        total: dirTotal,
        pending: dirPending,
        active: dirActive,
        rejected: dirRejected,
        verified: dirVerified,
        featured: dirFeatured,
      },
      revenue: {
        totalRevenue: revTotal._sum.amount ?? 0,
        membershipRevenue: revMembership._sum.amount ?? 0,
        businessRevenue: revBusiness._sum.amount ?? 0,
        jobRevenue: revJob._sum.amount ?? 0,
        adRevenue: revAd._sum.amount ?? 0,
        pendingPayments: revPending,
        failedPayments: revFailed,
        refundedPayments: revRefunded,
        successPayments: revSuccess,
      },
      ai: {
        totalRequests: aiTotal,
        completedRequests: aiCompleted,
        failedRequests: aiFailed,
        pendingRequests: aiPending,
        totalCostUsd: aiCostAgg._sum.costUsd ?? 0,
        activeProviders: aiActiveProviders,
        moderationRequests: aiModeration,
        matchRequests: aiMatch,
        assistantRequests: aiAssistant,
      },
      users: {
        total: userTotal,
        active: userActive,
        pending: userPending,
        blocked: userBlocked,
        rejected: userRejected,
        premium: userPremium,
        elite: userElite,
      },
      reports: {
        total: reportTotal,
        pending: reportPending,
        resolved: reportResolved,
        dismissed: reportDismissed,
      },
      notifications: {
        total: notifTotal,
        unread: notifUnread,
      },
      advertisements: {
        activeCampaigns: adActiveCampaigns,
        totalImpressions: adImpressionsAgg._sum.impressions ?? 0,
        totalClicks: adClicksAgg._sum.clicks ?? 0,
      },
      security: {
        recentSecurityEvents: secRecentEvents,
        criticalEvents: secCriticalEvents,
        lockedUsers: secLockedUsers,
      },
      gotra: {
        total: gotraTotal,
        active: gotraActive,
      },
    })
  } catch (err) {
    console.error('[OPS DASHBOARD] Error:', err)
    return serverError()
  }
}
