// ═══════════════════════════════════════════════════════════
// BANDHAN AI ASSISTANT
// Secure chat assistant for the Bandhan platform.
// Uses authenticated user context where needed.
// NEVER reveals private data, admin data, or security info.
// ═══════════════════════════════════════════════════════════

import type { AssistantContext, AssistantResponse } from './types'
import { executeChat } from './provider'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

const SYSTEM_PROMPT = `You are the Bandhan AI Assistant for Sahu Samaj Connect, a community platform for the Sahu community in Chhattisgarh, India.

You can help with:
- Matrimony: finding profiles, understanding match scores, profile tips
- Business: searching businesses, business categories
- Jobs: finding jobs, career advice, job matching
- Directory: community organizations, trusts, samitis
- Membership: explaining plans (FREE, PREMIUM ₹999/30d, ELITE ₹2499/30d), features
- Search: helping construct search queries
- Profile: tips for improving matrimony profiles
- General: navigation help, FAQs

Rules:
- NEVER reveal private user data, admin data, or internal security information
- NEVER make decisions for the user
- NEVER bypass privacy, permissions, membership limits, or Gotra rules
- If asked about sensitive topics (politics, religion outside community context), politely redirect
- Keep responses concise (2-4 sentences unless asked for detail)
- If you cannot help, say so clearly and suggest contacting support
- For matrimony: explain that matching considers Gotra, location, education, occupation, age, and preferences
- For membership: PREMIUM gets AI Couple Match + AI Photo Editor. ELITE adds AI Astrology.
- There are 93 Gotras in the master list
- Do NOT make up statistics or data
- Do NOT claim to have access to real-time user counts

Platform modules: Matrimony, Business Directory, Jobs, Community Directory
Auth: OTP-based login with phone/email
Locations: Chhattisgarh-focused (Raipur, Bhilai, Bilaspur, Durg, etc.)

If the user speaks Hindi, respond in Hindi. If English, respond in English. Match their language.`

/**
 * Process an assistant chat message.
 */
export async function assistantChat(params: {
  context: AssistantContext
  message: string
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
}): Promise<AssistantResponse> {
  const startMs = Date.now()
  const locale = params.context.locale

  // Build messages
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `User context: membershipTier=${params.context.membershipTier}, locale=${locale}${params.context.userName ? `, name=${params.context.userName}` : ''}${params.context.module ? `, currentModule=${params.context.module}` : ''}` },
  ]

  // Add conversation history (last 10 turns)
  if (params.conversationHistory) {
 const recent = params.conversationHistory.slice(-10)
    messages.push(...recent)
  }

  // Add current message
  messages.push({ role: 'user', content: params.message })

  // Call AI
  try {
    const result = await executeChat({
      messages,
      maxTokens: 1024,
      temperature: 0.7,
    })

    if (result.success && result.data?.content) {
      const responseText = result.data.content.trim()

      // Audit
      try {
        const aiReq = await createAIRequest({
          userId: params.context.userId,
          operation: 'ASSIST',
          provider: 'ZAI',
          model: result.model,
          inputSummary: params.message.slice(0, 200),
          inputContent: params.message,
        })
        await completeAIRequest({
          requestId: aiReq.id,
          status: 'COMPLETED',
          durationMs: Date.now() - startMs,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        })
        await recordAIUsage({
          operation: 'ASSIST', provider: 'ZAI', model: result.model,
          success: true, latencyMs: Date.now() - startMs,
          inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        })
      } catch { /* non-blocking */ }

      return {
        response: responseText,
        responseHi: locale === 'hi' ? responseText : responseText, // AI responds in the requested language
        module: detectModule(params.message),
      }
    }
  } catch (err) {
    console.error('[ASSISTANT] Chat failed:', err)
  }

  // Fallback responses (deterministic, never fake AI)
  const fallback = getDeterministicResponse(params.message, locale)
  return {
    response: fallback.en,
    responseHi: fallback.hi,
  }
}

/**
 * Detect which module a message is about.
 */
function detectModule(message: string): string | undefined {
  const lower = message.toLowerCase()
  if (/vivah|shadi|bride|groom|matrimony|match|परिणय|विवाह/.test(lower)) return 'matrimony'
  if (/business|dukandar|vyapar|व्यवसाय|दुकान/.test(lower)) return 'business'
  if (/job|naukri|career|नौकरी|रोज़गार/.test(lower)) return 'jobs'
  if (/organization|samiti|trust|sangathan|संगठन|समिति/.test(lower)) return 'directory'
  if (/member|premium|elite|plan|सदस्य/.test(lower)) return 'membership'
  return undefined
}

/**
 * Deterministic fallback responses when AI is unavailable.
 */
function getDeterministicResponse(message: string, locale: 'en' | 'hi'): { en: string; hi: string } {
  const lower = message.toLowerCase()

  if (/vivah|shadi|bride|groom|matrimony|विवाह/.test(lower)) {
    return {
      en: 'For matrimony, please visit the Matrimony section. You can create a profile, search for matches, and send contact requests. Matching considers Gotra compatibility, location, education, and preferences.',
      hi: 'विवाह के लिए कृपया विवाह अनुभाग पर जाएं। आप प्रोफ़ाइल बना सकते हैं, मेल खोज सकते हैं, और संपर्क अनुरोध भेज सकते हैं।',
    }
  }

  if (/premium|elite|membership|plan|सदस्य/.test(lower)) {
    return {
      en: 'Membership Plans: FREE (basic features), PREMIUM (₹999/30 days — AI Couple Match, AI Photo Editor), ELITE (₹2499/30 days — all Premium features plus AI Astrology). Visit the membership section to upgrade.',
      hi: 'सदस्यता योजनाएं: मुफ्त (मूल सुविधाएं), प्रीमियम (₹999/30 दिन — AI कपल मैच, AI फ़ोटो एडिटर), एलीट (₹2499/30 दिन — सभी प्रीमियम सुविधाएं + AI ज्योतिष)।',
    }
  }

  if (/help|मदद|kya/.test(lower)) {
    return {
      en: 'I can help you with: Matrimony profiles, Business search, Jobs, Community Directory, Membership plans, and general platform navigation. What would you like to know?',
      hi: 'मैं आपकी मदद कर सकता हूं: विवाह प्रोफ़ाइल, व्यवसाय खोज, नौकरियां, सामुदायिक निर्देशिका, सदस्यता योजनाएं। आप क्या जानना चाहेंगे?',
    }
  }

  return {
    en: 'AI Assistant is currently experiencing high demand. Please try again in a moment, or contact support for immediate assistance.',
    hi: 'AI सहायक वर्तमान में अधिक मांग का अनुभव कर रहा है। कृपया क्षण भर प्रतीक्षा करें या तत्काल सहायता के लिए सपोर्ट से संपर्क करें।',
  }
}
