// ═══════════════════════════════════════════════════════════
// AI ADMIN COPILOT
// Provides insights and summaries for Super Admin.
// AI explains data, does NOT execute dangerous actions.
// Critical actions require explicit Super Admin confirmation.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import type { AdminInsight, AdminCopilotResult } from './types'
import { executeChat } from './provider'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

/**
 * Generate admin insights from current platform data.
 */
export async function generateAdminInsights(params: {
  adminUserId: string
  locale?: 'en' | 'hi'
}): Promise<AdminCopilotResult> {
  const startMs = Date.now()
  const locale = params.locale || 'en'
  const insights: AdminInsight[] = []

  // Gather real data points
  const [
    totalUsers,
    activeUsers,
    pendingApprovals,
    recentReports,
    activeJobs,
    activeBusinesses,
    approvedMatrimony,
    recentRiskHigh,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: 'ACTIVE' } }),
    db.approval.count({ where: { status: 'PENDING' } }),
    db.report.count({ where: { status: 'PENDING' } }),
    db.job.count({ where: { status: 'ACTIVE' } }),
    db.business.count({ where: { status: 'ACTIVE' } }),
    db.matrimonyProfile.count({ where: { status: 'APPROVED' } }),
    db.report.count({ where: { status: { in: ['PENDING', 'REVIEWED'] } } }),
    db.riskAssessment.count({ where: { riskLevel: 'HIGH', resolution: null } }),
  ])

  // Pending approvals
  if (pendingApprovals > 0) {
    insights.push({
      category: 'approvals',
      title: `${pendingApprovals} Pending Approvals`,
      titleHi: `${pendingApprovals} लंबित अनुमोदन`,
      description: `There are ${pendingApprovals} users/content items awaiting approval. Consider reviewing them to reduce wait times.`,
      descriptionHi: `${pendingApprovals} उपयोगकर्ता/सामग्री अनुमोदन की प्रतीक्षा कर रहे हैं।`,
      severity: pendingApprovals > 20 ? 'WARNING' : 'INFO',
      actionRequired: false,
      data: { count: pendingApprovals },
    })
  }

  // Reports needing attention
  if (recentReports > 0) {
    insights.push({
      category: 'reports',
      title: `${recentReports} Unresolved Reports`,
      titleHi: `${recentReports} अनसुलझी रिपोर्ट`,
      description: `${recentReports} reports need review. Prioritize harassment and fraud reports.`,
      descriptionHi: `${recentReports} रिपोर्ट की समीक्षा आवश्यक।`,
      severity: recentReports > 5 ? 'WARNING' : 'INFO',
      actionRequired: true,
      data: { count: recentReports },
    })
  }

  // High risk items
  if (recentRiskHigh > 0) {
    insights.push({
      category: 'risk',
      title: `${recentRiskHigh} High-Risk Items`,
      titleHi: `${recentRiskHigh} उच्च-जोखिम आइटम`,
      description: `${recentRiskHigh} items flagged as high risk require immediate attention.`,
      descriptionHi: `${recentRiskHigh} उच्च-जोखिम आइटम तत्काल ध्यान चाहिए।`,
      severity: 'CRITICAL',
      actionRequired: true,
      data: { count: recentRiskHigh },
    })
  }

  // Platform growth
  insights.push({
    category: 'growth',
    title: `Platform: ${totalUsers} Users, ${activeUsers} Active`,
    titleHi: `प्लेटफ़ॉर्म: ${totalUsers} उपयोगकर्ता, ${activeUsers} सक्रिय`,
    description: `${approvedMatrimony} matrimony profiles, ${activeJobs} active jobs, ${activeBusinesses} businesses.`,
    descriptionHi: `${approvedMatrimony} विवाह प्रोफ़ाइल, ${activeJobs} सक्रिय नौकरियां, ${activeBusinesses} व्यवसाय।`,
    severity: 'INFO',
    actionRequired: false,
    data: { totalUsers, activeUsers, matrimony: approvedMatrimony, jobs: activeJobs, businesses: activeBusinesses },
  })

  // AI-generated summary
  let summary = 'Platform overview generated from current data.'
  let summaryHi = 'वर्तमान डेटा से प्लेटफ़ॉर्म अवलोकन तैयार किया गया।'

  try {
    const dataForAI = JSON.stringify({
      totalUsers, activeUsers, pendingApprovals, recentReports,
      activeJobs, activeBusinesses, approvedMatrimony, recentRiskHigh,
    })

    const aiPrompt = locale === 'hi'
      ? `इस प्लेटफ़ॉर्म डेटा का विश्लेषण करें और 2-3 वाक्यों में सारांश दें। यह सुपर एडमिन के लिए है। बस सारांश लौटाएं, कुछ भी निष्पादित न करें।
डेटा: ${dataForAI}`
      : `Analyze this platform data and provide a 2-3 sentence summary. This is for Super Admin. Just return the summary, do not execute anything.
Data: ${dataForAI}`

    const result = await executeChat({
      messages: [{ role: 'user', content: aiPrompt }],
      maxTokens: 256,
      temperature: 0.3,
    })

    if (result.success && result.data?.content) {
      if (locale === 'hi') {
        summaryHi = result.data.content
      } else {
        summary = result.data.content
      }
    }
  } catch {
    // Non-blocking
  }

  // Audit
  try {
    const aiReq = await createAIRequest({
      userId: params.adminUserId,
      operation: 'ADMIN_COPILOT',
      provider: 'ZAI',
      model: 'admin-copilot',
      inputSummary: 'Admin dashboard insights',
    })
    await completeAIRequest({
      requestId: aiReq.id,
      status: 'COMPLETED',
      durationMs: Date.now() - startMs,
    })
    await recordAIUsage({
      operation: 'ADMIN_COPILOT', provider: 'ZAI', model: 'admin-copilot',
      success: true, latencyMs: Date.now() - startMs,
    })
  } catch { /* non-blocking */ }

  return { insights, summary, summaryHi }
}