// ═══════════════════════════════════════════════════════════
// AI SMART SEARCH
// Converts natural language queries to structured filters.
// Final query MUST execute through existing secure search.
// AI must NEVER bypass privacy, permissions, or rules.
// ═══════════════════════════════════════════════════════════

import type { SmartSearchParseResult } from './types'
import { executeChat } from './provider'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

const SMART_SEARCH_SYSTEM = `You are a search query parser for an Indian community platform (Sahu Samaj Connect, Chhattisgarh).

Convert natural language search queries into structured JSON filters.

Available filter keys: gender (MALE/FEMALE), minAge, maxAge, city, state, district, education, occupation, gotraId, maritalStatus, familyType, category, type, isRemote, salaryMin, salaryMax, skills.

Available intents: MATRIMONY (bride/groom/match/vivah/shadi), BUSINESS (business/dukandar/ vyapar), JOB (job/naukri/career/vacancy), DIRECTORY (organization/samiti/trust/sangathan), GENERAL.

Languages: Hindi and English.

Rules:
- NEVER include filters that override privacy or permissions
- NEVER include admin-level filters
- If the query is ambiguous, set confidence lower
- If you cannot determine a filter, omit it

Respond ONLY in valid JSON:
{
  "filters": { "key": "value" },
  "query": "cleaned search text",
  "intent": "MATRIMONY|BUSINESS|JOB|DIRECTORY|GENERAL",
  "language": "en|hi",
  "confidence": 0.0-1.0
}`

/**
 * Parse a natural language query into structured search filters.
 */
export async function parseSmartSearch(params: {
  query: string
  userId?: string
  locale?: 'en' | 'hi'
}): Promise<SmartSearchParseResult> {
  const startMs = Date.now()

  // Fast-path: if query is already structured (has colon-separated keys), return as-is
  if (/^\w+:/.test(params.query) && params.query.includes('=')) {
    const filters: Record<string, unknown> = {}
    for (const part of params.query.split(/[\n|&]/)) {
      const [key, ...vals] = part.split('=')
      if (key && vals.length) {
        const val = vals.join('=').trim()
        if (['minAge', 'maxAge', 'salaryMin', 'salaryMax'].includes(key.trim())) {
          filters[key.trim()] = parseInt(val, 10)
        } else {
          filters[key.trim()] = val
        }
      }
    }
    return {
      filters,
      query: params.query,
      intent: 'GENERAL',
      language: params.locale || 'en',
      confidence: 0.9,
    }
  }

  // AI parsing
  try {
    const result = await executeChat({
      messages: [
        { role: 'system', content: SMART_SEARCH_SYSTEM },
        { role: 'user', content: params.query },
      ],
      maxTokens: 512,
      temperature: 0.1,
      jsonMode: true,
    })

    if (result.success && result.data?.content) {
      const parsed = JSON.parse(result.data.content)

      await recordAIUsage({
        operation: 'SMART_SEARCH', provider: 'ZAI',
        success: true, latencyMs: Date.now() - startMs,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      })

      return {
        filters: parsed.filters || {},
        query: parsed.query || params.query,
        intent: parsed.intent || 'GENERAL',
        language: parsed.language || (params.locale || 'en'),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      }
    }
  } catch (err) {
    console.error('[SMART_SEARCH] Parse failed:', err)
  }

  return {
    filters: {},
    query: params.query,
    intent: 'GENERAL',
    language: params.locale || 'en',
    confidence: 0,
  }
}
