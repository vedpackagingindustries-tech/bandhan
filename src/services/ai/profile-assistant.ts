// ═══════════════════════════════════════════════════════════
// AI PROFILE ASSISTANT
// Helps users improve profiles, suggest missing info, translate.
// NEVER invents personal facts. User must approve before saving.
// ═══════════════════════════════════════════════════════════

import type { ProfileAssistantResult, ProfileSuggestion } from './types'
import { executeChat } from './provider'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

const MATRIMONY_FIELDS = [
  'aboutMe', 'height', 'weight', 'complexion', 'education', 'occupation',
  'annualIncome', 'employerName', 'workingCity', 'familyType', 'familyValues',
  'fatherName', 'fatherOccupation', 'motherName', 'motherOccupation',
]

const FIELD_LABELS: Record<string, { en: string; hi: string }> = {
  aboutMe: { en: 'About Me', hi: 'मेरे बारे में' },
  height: { en: 'Height', hi: 'लंबाई' },
  weight: { en: 'Weight', hi: 'वजन' },
  complexion: { en: 'Complexion', hi: 'रंगत' },
  education: { en: 'Education', hi: 'शिक्षा' },
  occupation: { en: 'Occupation', hi: 'पेशा' },
  annualIncome: { en: 'Annual Income', hi: 'वार्षिक आय' },
  employerName: { en: 'Employer Name', hi: 'नियोक्ता का नाम' },
  workingCity: { en: 'Working City', hi: 'कार्य स्थल' },
  familyType: { en: 'Family Type', hi: 'परिवार प्रकार' },
  familyValues: { en: 'Family Values', hi: 'पारिवारिक मूल्य' },
  fatherName: { en: 'Father\'s Name', hi: 'पिता का नाम' },
  fatherOccupation: { en: 'Father\'s Occupation', hi: 'पिता का पेशा' },
  motherName: { en: 'Mother\'s Name', hi: 'माता का नाम' },
  motherOccupation: { en: 'Mother\'s Occupation', hi: 'माता का पेशा' },
  profilePhoto: { en: 'Profile Photo', hi: 'प्रोफ़ाइल फ़ोटो' },
  dateOfBirth: { en: 'Date of Birth', hi: 'जन्म तिथि' },
  bio: { en: 'Bio', hi: 'परिचय' },
}

/**
 * Analyze a matrimony profile and provide improvement suggestions.
 */
export async function analyzeProfile(params: {
  profileId: string
  userId?: string
  locale?: 'en' | 'hi'
}): Promise<ProfileAssistantResult> {
  const startMs = Date.now()
  const locale = params.locale || 'en'

  const { db } = await import('@/lib/db')
  const matrimony = await db.matrimonyProfile.findUnique({
    where: { profileId: params.profileId },
    include: {
      profile: {
        select: {
          firstName: true, lastName: true, displayName: true, gender: true,
          dateOfBirth: true, education: true, occupation: true, city: true,
          state: true, bio: true, profilePhotoUrl: true, gotraMaster: { select: { name: true } },
        },
      },
    },
  })

  if (!matrimony) {
    return { suggestions: [], completenessScore: 0, missingFields: [] }
  }

  const p = matrimony.profile
  const m = matrimony

  // Calculate completeness
  let filled = 0
  let total = MATRIMONY_FIELDS.length + 5
  const missingFields: string[] = []

  if (p.firstName) { filled++; } else { missingFields.push('firstName') }
  if (p.lastName) { filled++; } else { missingFields.push('lastName') }
  if (p.profilePhotoUrl) { filled++; } else { missingFields.push('profilePhoto') }
  if (p.dateOfBirth) { filled++; } else { missingFields.push('dateOfBirth') }
  if (p.bio) { filled++; } else { missingFields.push('bio') }

  for (const field of MATRIMONY_FIELDS) {
    const val = (m as Record<string, unknown>)[field]
    if (val && val !== '' && val !== null && val !== undefined) {
      filled++
    } else {
      missingFields.push(field)
    }
  }

  const completenessScore = Math.round((filled / total) * 100)

  // Build suggestions
  const suggestions: ProfileSuggestion[] = []

  for (const field of missingFields) {
    const label = FIELD_LABELS[field]
    if (label) {
      suggestions.push({
        field,
        currentValue: '',
        suggestion: `Add ${label.en} — this improves your profile completeness`,
        suggestionHi: `${label.hi} जोड़ें — यह प्रोफ़ाइल को पूर्ण बनाता है`,
        reason: 'Incomplete information may affect match quality',
        reasonHi: 'अधूरी जानकारी मेल निर्णय को प्रभावित करती है',
      })
    }
  }

  // AI About Me improvement
  let improvedAboutMe: string | undefined
  let improvedAboutMeHi: string | undefined

  if (m.aboutMe && m.aboutMe.length > 10) {
    try {
      const systemPrompt = `You are a profile writing assistant for a matrimonial platform (Sahu Samaj community). 
Improve the given About Me text to be clearer and more engaging. 
Rules:
- Do NOT invent any personal facts
- Do NOT change the meaning
- Keep the same length (within 20%)
- Make it more readable and positive
- First improve in English, then in Hindi
Respond ONLY in JSON: {"english": "...", "hindi": "..."}`

      const result = await executeChat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: m.aboutMe },
        ],
        maxTokens: 512,
        temperature: 0.5,
        jsonMode: true,
      })

      if (result.success && result.data?.content) {
        const parsed = JSON.parse(result.data.content)
        improvedAboutMe = String(parsed.english || '').slice(0, 1000)
        improvedAboutMeHi = String(parsed.hindi || '').slice(0, 1000)
      }
    } catch {
      // AI failure is non-blocking
    }
  }

  // Audit
  try {
    const aiReq = await createAIRequest({
      userId: params.userId,
      operation: 'PROFILE_ASSIST',
      provider: 'ZAI',
      model: 'profile-assistant',
      inputSummary: `Profile analysis for ${params.profileId}`,
      inputContent: params.profileId,
    })
    await completeAIRequest({
      requestId: aiReq.id,
      status: 'COMPLETED',
      confidence: completenessScore / 100,
      durationMs: Date.now() - startMs,
    })
    await recordAIUsage({
      operation: 'PROFILE_ASSIST', provider: 'ZAI', model: 'profile-assistant',
      success: true, latencyMs: Date.now() - startMs,
    })
  } catch { /* non-blocking */ }

  return { suggestions, completenessScore, missingFields, improvedAboutMe, improvedAboutMeHi }
}

/**
 * Translate text between Hindi and English.
 */
export async function translateText(params: {
  text: string
  from: 'en' | 'hi'
  to: 'en' | 'hi'
  userId?: string
}): Promise<{ translated: string; provider: string }> {
  const startMs = Date.now()
  const direction = params.from === 'en' ? 'Hindi' : 'English'

  try {
    const result = await executeChat({
      messages: [
        {
          role: 'system',
          content: `Translate the following text to ${direction}. Return ONLY the translated text, nothing else. Do not add explanations.`,
        },
        { role: 'user', content: params.text },
      ],
      maxTokens: 1024,
      temperature: 0.2,
    })

    if (result.success && result.data?.content) {
      await recordAIUsage({
        operation: 'TRANSLATE', provider: result.model ? 'ZAI' : 'ZAI',
        success: true, latencyMs: Date.now() - startMs,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      })
      return { translated: result.data.content.trim(), provider: 'ZAI' }
    }
  } catch {
    // Fall through
  }

  return { translated: params.text, provider: 'fallback' }
}
