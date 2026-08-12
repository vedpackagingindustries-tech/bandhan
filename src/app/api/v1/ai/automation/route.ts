import { success, error, serverError } from '@/lib/api-response'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'
import { runRegistrationWorkflow, runContentWorkflow } from '@/services/ai/automation'
import type { AutomationWorkflowType } from '@/services/ai/types'
import { NextRequest } from 'next/server'

/**
 * AI Automation Workflows
 * POST /api/v1/ai/automation
 * Body: { workflowType, targetId, contentText?, imageUrl?, mediaId? }
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAuth(request)
    if (result.error) return result.error

    // Only admin can trigger workflows manually
    const role = (result.auth as any).user?.role;
    if (!role || role.level < 4) {
      return error('Admin access required', 403)
    }

    const body = await request.json()
    const { workflowType, targetId, contentText, imageUrl, mediaId } = body

    const validTypes: AutomationWorkflowType[] = ['REGISTRATION', 'ADVERTISEMENT', 'JOB_POSTING', 'BUSINESS_LISTING', 'MATRIMONY_PROFILE', 'DIRECTORY_LISTING']
    if (!workflowType || !validTypes.includes(workflowType)) {
      return error(`Invalid workflowType. Use: ${validTypes.join(', ')}`)
    }
    if (!targetId) return error('targetId is required')

    let workflowResult
    if (workflowType === 'REGISTRATION') {
      workflowResult = await runRegistrationWorkflow({ userId: targetId })
    } else {
      workflowResult = await runContentWorkflow({
        workflowType,
        targetId,
        userId: result.auth.userId,
        contentText,
        imageUrl,
        mediaId,
      })
    }

    return success(workflowResult)
  } catch (err) {
    console.error('[AI AUTOMATION] Error:', err)
    return serverError('Automation workflow failed')
  }
}
