// ═══════════════════════════════════════════════════════════
// AI COUPLE MATCH 2.0 — PRODUCTION MATCHING ENGINE
// Modular scoring pipeline with deterministic + AI layers.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import type { MatchFactor, MatchResult, EligibilityResult } from './types'
import { executeChat } from './provider'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

// --- Scoring Pipeline ---

/**
 * Step 1: Eligibility Filter
 * Check if both profiles can be matched at all.
 */
async function checkEligibility(profileA: FullProfileData, profileB: FullProfileData): Promise<EligibilityResult> {
  const reasons: string[] = []
  let eligible = true

  // Both must have active matrimony profiles
  if (!profileA.matrimony || profileA.matrimony.status !== 'APPROVED') {
    reasons.push('Profile A matrimony not approved')
    eligible = false
  }
  if (!profileB.matrimony || profileB.matrimony.status !== 'APPROVED') {
    reasons.push('Profile B matrimony not approved')
    eligible = false
  }

  // Both must have active users
  if (profileA.user?.status !== 'ACTIVE') {
    reasons.push('Profile A user not active')
    eligible = false
  }
  if (profileB.user?.status !== 'ACTIVE') {
    reasons.push('Profile B user not active')
    eligible = false
  }

  // Cannot match same profile
  if (profileA.id === profileB.id) {
    reasons.push('Cannot match a profile with itself')
    eligible = false
  }

  // Same gender check (matrimony is opposite-gender)
  if (profileA.matrimony && profileB.matrimony && profileA.matrimony.gender === profileB.matrimony.gender) {
    reasons.push('Same gender — not applicable for matrimony matching')
    eligible = false
  }

  // Blocked check
  if (profileA.blockedIds?.includes(profileB.id)) {
    reasons.push('Profile A has blocked Profile B')
    eligible = false
  }
  if (profileB.blockedIds?.includes(profileA.id)) {
    reasons.push('Profile B has blocked Profile A')
    eligible = false
  }

  // Rejected/blocked matrimony profiles
  if (profileA.matrimony?.status === 'BLOCKED' || profileA.matrimony?.status === 'REJECTED') {
    reasons.push('Profile A matrimony is blocked/rejected')
    eligible = false
  }
  if (profileB.matrimony?.status === 'BLOCKED' || profileB.matrimony?.status === 'REJECTED') {
    reasons.push('Profile B matrimony is blocked/rejected')
    eligible = false
  }

  return { eligible, reasons }
}

/**
 * Step 2: Privacy Filter
 * Ensure neither profile has restricted visibility.
 */
function checkPrivacy(profileA: FullProfileData, profileB: FullProfileData): EligibilityResult {
  const reasons: string[] = []
  let eligible = true

  if (profileA.profileVisible === false) {
    reasons.push('Profile A is not visible')
    eligible = false
  }
  if (profileB.profileVisible === false) {
    reasons.push('Profile B is not visible')
    eligible = false
  }

  return { eligible, reasons }
}

/**
 * Step 3: Gotra Compatibility
 * Same gotra = NOT a match (traditional Sahu Samaj rule).
 * Uses the 93-record Gotra Master — never free-text.
 */
function scoreGotra(profileA: FullProfileData, profileB: FullProfileData): MatchFactor {
  const pAGotra = profileA.gotraMaster
  const pBGotra = profileB.gotraMaster

  // Both must have Gotra from master
  if (!pAGotra || !pBGotra) {
    return {
      name: 'gotra',
      weight: 20,
      score: 0,
      matched: false,
      details: 'One or both profiles lack Gotra Master assignment',
    }
  }

  // Same gotra = not compatible
  if (pAGotra.id === pBGotra.id) {
    return {
      name: 'gotra',
      weight: 20,
      score: 0,
      matched: false,
      details: `Both profiles belong to ${pAGotra.name} — not compatible per tradition`,
    }
  }

  return {
    name: 'gotra',
    weight: 20,
    score: 100,
    matched: true,
    details: `Different Gotras: ${pAGotra.name} and ${pBGotra.name} — compatible`,
  }
}

/**
 * Step 4: Location Scoring
 */
function scoreLocation(profileA: FullProfileData, profileB: FullProfileData): MatchFactor {
  const aCity = profileA.matrimony?.cityId
  const bCity = profileB.matrimony?.cityId
  const aDistrict = profileA.matrimony?.districtId
  const bDistrict = profileB.matrimony?.districtId

  let score = 30 // Base score (different locations not penalized heavily)
  let details = 'Different locations'

  if (aCity && bCity && aCity === bCity) {
    score = 100
    details = 'Same city'
  } else if (aDistrict && bDistrict && aDistrict === bDistrict) {
    score = 75
    details = 'Same district'
  } else {
    // Same state gets bonus
    const aState = profileA.state || 'Chhattisgarh'
    const bState = profileB.state || 'Chhattisgarh'
    if (aState === bState) {
      score = 55
      details = 'Same state'
    }
  }

  return {
    name: 'location',
    weight: 15,
    score,
    matched: score >= 50,
    details,
  }
}

/**
 * Step 5: Education Scoring
 */
function scoreEducation(profileA: FullProfileData, profileB: FullProfileData): MatchFactor {
  const aEdu = (profileA.matrimony?.education || profileA.education || '').toLowerCase()
  const bEdu = (profileB.matrimony?.education || profileB.education || '').toLowerCase()

  if (!aEdu || !bEdu) {
    return { name: 'education', weight: 15, score: 50, matched: false, details: 'Education data incomplete' }
  }

  const eduLevels = ['none', 'school', 'higher secondary', 'diploma', 'bachelor', 'master', 'phd', 'doctor']
  const getLevel = (edu: string) => {
    const idx = eduLevels.findIndex(l => edu.includes(l))
    return idx >= 0 ? idx : 2
  }

  const aLevel = getLevel(aEdu)
  const bLevel = getLevel(bEdu)
  const diff = Math.abs(aLevel - bLevel)

  let score: number
  let details: string
  if (diff === 0) {
    score = 100
    details = 'Same education level'
  } else if (diff === 1) {
    score = 80
    details = 'Similar education levels'
  } else if (diff === 2) {
    score = 55
    details = 'Moderate education difference'
  } else {
    score = 30
    details = 'Significant education difference'
  }

  return { name: 'education', weight: 15, score, matched: score >= 50, details }
}

/**
 * Step 6: Occupation Scoring
 */
function scoreOccupation(profileA: FullProfileData, profileB: FullProfileData): MatchFactor {
  const aOcc = (profileA.matrimony?.occupation || profileA.occupation || '').toLowerCase()
  const bOcc = (profileB.matrimony?.occupation || profileB.occupation || '').toLowerCase()

  if (!aOcc || !bOcc) {
    return { name: 'occupation', weight: 10, score: 50, matched: false, details: 'Occupation data incomplete' }
  }

  // Same occupation category
  if (aOcc === bOcc) {
    return { name: 'occupation', weight: 10, score: 100, matched: true, details: 'Same occupation' }
  }

  // Professional categories
  const profCategories = ['engineer', 'doctor', 'teacher', 'business', 'government', 'lawyer', 'accountant', 'manager', 'software', 'it']
  const aProf = profCategories.some(c => aOcc.includes(c))
  const bProf = profCategories.some(c => bOcc.includes(c))

  if (aProf && bProf) {
    return { name: 'occupation', weight: 10, score: 75, matched: true, details: 'Both in professional categories' }
  }

  return { name: 'occupation', weight: 10, score: 50, matched: false, details: 'Different occupation categories' }
}

/**
 * Step 7: Age Compatibility Scoring
 */
function scoreAge(profileA: FullProfileData, profileB: FullProfileData): MatchFactor {
  const aDob = profileA.matrimony?.dateOfBirth || profileA.dateOfBirth
  const bDob = profileB.matrimony?.dateOfBirth || profileB.dateOfBirth

  if (!aDob || !bDob) {
    return { name: 'age', weight: 10, score: 50, matched: false, details: 'Date of birth data incomplete' }
  }

  const parseDob = (dob: string) => {
    const d = new Date(dob)
    return isNaN(d.getTime()) ? null : d
  }

  const aDate = parseDob(aDob)
  const bDate = parseDob(bDob)
  if (!aDate || !bDate) {
    return { name: 'age', weight: 10, score: 50, matched: false, details: 'Could not parse dates' }
  }

  const ageA = Math.floor((Date.now() - aDate.getTime()) / (365.25 * 86400000))
  const ageB = Math.floor((Date.now() - bDate.getTime()) / (365.25 * 86400000))
  const diff = Math.abs(ageA - ageB)

  let score: number
  let details: string
  if (diff <= 2) {
    score = 100
    details = `${diff} year age difference`
  } else if (diff <= 5) {
    score = 80
    details = `${diff} year age difference — generally compatible`
  } else if (diff <= 10) {
    score = 55
    details = `${diff} year age difference — moderate gap`
  } else {
    score = 25
    details = `${diff} year age difference — significant gap`
  }

  return { name: 'age', weight: 10, score, matched: score >= 50, details }
}

/**
 * Step 8: Preference Matching
 * Compares profile A's partner preferences against profile B's actual data.
 */
function scorePreferences(profileA: FullProfileData, profileB: FullProfileData): MatchFactor {
  const prefs = profileA.matrimony?.partnerPreferences
  if (!prefs || typeof prefs !== 'object') {
    return { name: 'preferences', weight: 30, score: 50, matched: false, details: 'No partner preferences set' }
  }

  const pref = prefs as Record<string, unknown>
  let matched = 0
  let total = 0
  const matchedItems: string[] = []
  const unmatchedItems: string[] = []

  // Age preference
  if (pref.minAge || pref.maxAge) {
    total++
    const bDob = profileB.matrimony?.dateOfBirth || profileB.dateOfBirth
    if (bDob) {
      const bDate = new Date(bDob)
      const ageB = Math.floor((Date.now() - bDate.getTime()) / (365.25 * 86400000))
      const minAge = (pref.minAge as number) || 18
      const maxAge = (pref.maxAge as number) || 100
      if (ageB >= minAge && ageB <= maxAge) {
        matched++
        matchedItems.push('age')
      } else {
        unmatchedItems.push('age')
      }
    }
  }

  // Height preference
  if (pref.minHeight || pref.maxHeight) {
    total++
    const bHeight = profileB.matrimony?.height
    if (bHeight) {
      const minH = (pref.minHeight as number) || 0
      const maxH = (pref.maxHeight as number) || 300
      if (bHeight >= minH && bHeight <= maxH) {
        matched++
        matchedItems.push('height')
      } else {
        unmatchedItems.push('height')
      }
    }
  }

  // Education preference
  if (pref.education) {
    total++
    const bEdu = (profileB.matrimony?.education || profileB.education || '').toLowerCase()
    const prefEdu = (pref.education as string).toLowerCase()
    if (bEdu && bEdu.includes(prefEdu)) {
      matched++
      matchedItems.push('education')
    } else {
      unmatchedItems.push('education')
    }
  }

  // Marital status preference
  if (pref.maritalStatus) {
    total++
    const bStatus = profileB.matrimony?.maritalStatus || profileB.maritalStatus
    if (bStatus && bStatus === pref.maritalStatus) {
      matched++
      matchedItems.push('marital status')
    } else {
      unmatchedItems.push('marital status')
    }
  }

  // Location preference
  if (pref.city || pref.district) {
    total++
    const bCity = profileB.matrimony?.cityId
    const bDistrict = profileB.matrimony?.districtId
    if ((pref.city && bCity === pref.city) || (pref.district && bDistrict === pref.district)) {
      matched++
      matchedItems.push('location')
    } else {
      unmatchedItems.push('location')
    }
  }

  // Family type preference
  if (pref.familyType) {
    total++
    const bFamily = profileB.matrimony?.familyType
    if (bFamily && bFamily === pref.familyType) {
      matched++
      matchedItems.push('family type')
    } else {
      unmatchedItems.push('family type')
    }
  }

  if (total === 0) {
    return { name: 'preferences', weight: 30, score: 50, matched: false, details: 'No specific preferences to evaluate' }
  }

  const score = Math.round((matched / total) * 100)
  const details = `Matched ${matched}/${total} preferences: ${matchedItems.join(', ')}${unmatchedItems.length > 0 ? `. Unmatched: ${unmatchedItems.join(', ')}` : ''}`

  return { name: 'preferences', weight: 30, score, matched: score >= 50, details }
}

/**
 * Step 9: AI Compatibility Analysis (via LLM)
 * Adds an AI perspective on top of deterministic scores.
 */
async function aiCompatibilityAnalysis(
  profileA: FullProfileData,
  profileB: FullProfileData,
  deterministicScore: number,
  factors: MatchFactor[]
): Promise<{ score: number; explanation: string; positiveFactors: string[]; potentialDifferences: string[] }> {
  const provider = await (await import('./provider')).getProviderFor('chat')
  if (!provider) {
    return {
      score: 0,
      explanation: 'AI analysis not available — relying on deterministic scoring.',
      positiveFactors: factors.filter(f => f.matched).map(f => f.details),
      potentialDifferences: factors.filter(f => !f.matched).map(f => f.details),
    }
  }

  const systemPrompt = `You are a matrimonial compatibility advisor for the Sahu Samaj community.
Analyze the compatibility between two profiles and provide:
1. An AI compatibility score (0-100)
2. A brief explanation (2-3 sentences)
3. List of positive match factors (array of strings)
4. List of potential differences (array of strings)

Respond ONLY in valid JSON format:
{"score": number, "explanation": "string", "positiveFactors": ["string"], "potentialDifferences": ["string"]}

Do NOT make discriminatory conclusions. Do NOT present AI output as certainty.
Be respectful and culturally appropriate.`

  const userProfile = (p: FullProfileData) => {
    const parts = [`Gender: ${p.matrimony?.gender || p.gender || 'unknown'}`]
    if (p.matrimony?.education || p.education) parts.push(`Education: ${p.matrimony?.education || p.education}`)
    if (p.matrimony?.occupation || p.occupation) parts.push(`Occupation: ${p.matrimony?.occupation || p.occupation}`)
    if (p.matrimony?.familyType) parts.push(`Family: ${p.matrimony.familyType}`)
    if (p.matrimony?.familyValues) parts.push(`Values: ${p.matrimony.familyValues}`)
    if (p.matrimony?.aboutMe) parts.push(`About: ${(p.matrimony.aboutMe || '').slice(0, 200)}`)
    return parts.join('\n')
  }

  const userPrompt = `Profile A:\n${userProfile(profileA)}\n\nProfile B:\n${userProfile(profileB)}\n\nDeterministic score: ${deterministicScore}/100\nFactor breakdown: ${factors.map(f => `${f.name}: ${f.score}/100 (${f.details})`).join('; ')}\n\nProvide your AI-enhanced analysis.`

  try {
    const result = await (await import('./provider')).executeChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 1024,
      temperature: 0.3,
      jsonMode: true,
    })

    if (result.success && result.data?.content) {
      const parsed = JSON.parse(result.data.content)
      return {
        score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 0,
        explanation: String(parsed.explanation || '').slice(0, 500),
        positiveFactors: Array.isArray(parsed.positiveFactors) ? parsed.positiveFactors.slice(0, 10).map(String) : [],
        potentialDifferences: Array.isArray(parsed.potentialDifferences) ? parsed.potentialDifferences.slice(0, 10).map(String) : [],
      }
    }
  } catch (err) {
    console.error('[MATCH_ENGINE] AI analysis failed:', err)
  }

  return {
    score: 0,
    explanation: 'AI analysis could not be completed — relying on deterministic scoring.',
    positiveFactors: factors.filter(f => f.matched).map(f => f.details),
    potentialDifferences: factors.filter(f => !f.matched).map(f => f.details),
  }
}

// --- Internal Types ---

interface FullProfileData {
  id: string
  gender?: string
  dateOfBirth?: string | null
  education?: string | null
  occupation?: string | null
  maritalStatus?: string | null
  state?: string | null
  profileVisible?: boolean
  gotraId?: string | null
  gotraMaster?: { id: string; name: string; slug: string } | null
  matrimony?: {
    status: string
    gender: string
    dateOfBirth?: string | null
    height?: number | null
    education?: string | null
    occupation?: string | null
    annualIncome?: number | null
    employerName?: string | null
    workingCity?: string | null
    cityId?: string | null
    districtId?: string | null
    tehsilId?: string | null
    maritalStatus?: string | null
    partnerPreferences?: unknown
    familyType?: string | null
    familyValues?: string | null
    aboutMe?: string | null
  } | null
  user?: { status: string } | null
  blockedIds?: string[]
}

/**
 * Fetch full profile data for matching.
 */
async function fetchFullProfile(profileId: string): Promise<FullProfileData | null> {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      gender: true,
      dateOfBirth: true,
      education: true,
      occupation: true,
      maritalStatus: true,
      state: true,
      profileVisible: true,
      gotraId: true,
      gotraMaster: { select: { id: true, name: true, slug: true } },
      matrimonyProfile: {
        select: {
          status: true,
          gender: true,
          dateOfBirth: true,
          height: true,
          education: true,
          occupation: true,
          cityId: true,
          districtId: true,
          partnerPreferences: true,
          familyType: true,
          familyValues: true,
          aboutMe: true,
        },
      },
      user: { select: { status: true } },
    },
  })

  if (!profile) return null

  // Get blocked user IDs
  const blockedUsers = await db.userBlock.findMany({
    where: { blockerId: profile.id },
    select: { blockedId: true },
  })

  return {
    id: profile.id,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    education: profile.education,
    occupation: profile.occupation,
    maritalStatus: profile.maritalStatus,
    state: profile.state,
    profileVisible: profile.profileVisible,
    gotraId: profile.gotraId,
    gotraMaster: profile.gotraMaster,
    matrimony: profile.matrimonyProfile || null,
    blockedIds: blockedUsers.map(b => b.blockedId),
  }
}

// --- Public API ---

/**
 * Full production matching pipeline.
 * Eligibility → Privacy → Gotra Rule → Location → Education → Occupation → Age → Preferences → AI Analysis → Weighted Score → Recommendation
 */
export async function matchProfiles(params: {
  profileIdA: string
  profileIdB: string
  userId?: string
  locale?: 'en' | 'hi'
}): Promise<MatchResult> {
  const startMs = Date.now()

  // Fetch profiles
  const [profileA, profileB] = await Promise.all([
    fetchFullProfile(params.profileIdA),
    fetchFullProfile(params.profileIdB),
  ])

  if (!profileA || !profileB) {
    return {
      profileIdA: params.profileIdA,
      profileIdB: params.profileIdB,
      overallScore: 0,
      factors: [],
      positiveFactors: ['One or both profiles not found'],
      potentialDifferences: [],
      explanation: 'Profile lookup failed.',
      recommendation: 'NOT_RECOMMENDED',
      confidence: 0,
    }
  }

  // Pipeline
  const eligibility = await checkEligibility(profileA, profileB)
  if (!eligibility.eligible) {
    return {
      profileIdA: params.profileIdA,
      profileIdB: params.profileIdB,
      overallScore: 0,
      factors: [],
      positiveFactors: [],
      potentialDifferences: eligibility.reasons,
      explanation: eligibility.reasons.join('. '),
      recommendation: 'NOT_RECOMMENDED',
      confidence: 1.0,
    }
  }

  const privacy = checkPrivacy(profileA, profileB)
  if (!privacy.eligible) {
    return {
      profileIdA: params.profileIdA,
      profileIdB: params.profileIdB,
      overallScore: 0,
      factors: [],
      positiveFactors: [],
      potentialDifferences: privacy.reasons,
      explanation: privacy.reasons.join('. '),
      recommendation: 'NOT_RECOMMENDED',
      confidence: 1.0,
    }
  }

  // Deterministic scoring factors
  const gotraFactor = scoreGotra(profileA, profileB)
  const locationFactor = scoreLocation(profileA, profileB)
  const educationFactor = scoreEducation(profileA, profileB)
  const occupationFactor = scoreOccupation(profileA, profileB)
  const ageFactor = scoreAge(profileA, profileB)
  const preferenceFactor = scorePreferences(profileA, profileB)

  const deterministicFactors = [gotraFactor, locationFactor, educationFactor, occupationFactor, ageFactor, preferenceFactor]

  // Weighted deterministic score
  const totalWeight = deterministicFactors.reduce((s, f) => s + f.weight, 0)
  const deterministicScore = Math.round(
    deterministicFactors.reduce((s, f) => s + (f.score * f.weight) / totalWeight, 0)
  )

  // AI analysis (async, non-blocking for the pipeline)
  let aiResult = { score: 0, explanation: '', positiveFactors: [] as string[], potentialDifferences: [] as string[] }
  try {
    aiResult = await aiCompatibilityAnalysis(profileA, profileB, deterministicScore, deterministicFactors)
  } catch {
    // AI failure doesn't break matching
  }

  // Final score: 80% deterministic + 20% AI (when available)
  const aiContribution = aiResult.score > 0 ? aiResult.score * 0.2 : 0
  const finalScore = Math.min(100, Math.round(deterministicScore * 0.8 + aiContribution))

  // Recommendation
  let recommendation: MatchResult['recommendation']
  if (finalScore >= 70 && gotraFactor.matched) {
    recommendation = 'RECOMMENDED'
  } else if (finalScore >= 45 && gotraFactor.matched) {
    recommendation = 'POTENTIAL'
  } else {
    recommendation = 'NOT_RECOMMENDED'
  }

  const confidence = gotraFactor.matched
    ? Math.min(0.95, 0.6 + (finalScore / 100) * 0.35)
    : 0.3

  const result: MatchResult = {
    profileIdA: params.profileIdA,
    profileIdB: params.profileIdB,
    overallScore: finalScore,
    factors: deterministicFactors.map(f => ({
      name: f.name,
      weight: f.weight,
      score: f.score,
      matched: f.matched,
      details: f.details,
    })),
    positiveFactors: aiResult.positiveFactors.length > 0
      ? aiResult.positiveFactors
      : deterministicFactors.filter(f => f.matched).map(f => f.details),
    potentialDifferences: aiResult.potentialDifferences.length > 0
      ? aiResult.potentialDifferences
      : deterministicFactors.filter(f => !f.matched).map(f => f.details),
    explanation: aiResult.explanation || `Overall compatibility score of ${finalScore}/100 based on ${deterministicFactors.filter(f => f.matched).length} matching factors.`,
    recommendation,
    confidence,
  }

  // Persist MatchScore
  try {
    const aiRequest = await createAIRequest({
      userId: params.userId,
      operation: 'MATCH',
      provider: 'ZAI',
      model: 'match-engine-v2',
      inputSummary: `Match ${params.profileIdA} vs ${params.profileIdB}`,
      inputContent: `${params.profileIdA}:${params.profileIdB}:${deterministicScore}`,
    })

    await db.matchScore.upsert({
      where: {
        profileIdA_profileIdB: {
          profileIdA: params.profileIdA,
          profileIdB: params.profileIdB,
        },
      },
      create: {
        profileIdA: params.profileIdA,
        profileIdB: params.profileIdB,
        overallScore: finalScore,
        gotraScore: gotraFactor.score,
        locationScore: locationFactor.score,
        educationScore: educationFactor.score,
        occupationScore: occupationFactor.score,
        ageScore: ageFactor.score,
        preferenceScore: preferenceFactor.score,
        aiScore: aiResult.score,
        factorsJson: JSON.stringify(deterministicFactors),
        recommendation,
        confidence,
        aiRequestId: aiRequest.id,
      },
      update: {
        overallScore: finalScore,
        gotraScore: gotraFactor.score,
        locationScore: locationFactor.score,
        educationScore: educationFactor.score,
        occupationScore: occupationFactor.score,
        ageScore: ageFactor.score,
        preferenceScore: preferenceFactor.score,
        aiScore: aiResult.score,
        factorsJson: JSON.stringify(deterministicFactors),
        recommendation,
        confidence,
        aiRequestId: aiRequest.id,
      },
    })

    await completeAIRequest({
      requestId: aiRequest.id,
      status: 'COMPLETED',
      resultStatus: recommendation,
      confidence,
      durationMs: Date.now() - startMs,
      inputTokens: 0,
      outputTokens: 0,
    })

    await recordAIUsage({
      operation: 'MATCH',
      provider: 'ZAI',
      model: 'match-engine-v2',
      success: true,
      latencyMs: Date.now() - startMs,
    })
  } catch (err) {
    console.error('[MATCH_ENGINE] Persistence failed:', err)
  }

  return result
}

/**
 * Get cached match score if available.
 */
export async function getCachedMatch(profileIdA: string, profileIdB: string) {
  return db.matchScore.findUnique({
    where: {
      profileIdA_profileIdB: {
        profileIdA: profileIdA,
        profileIdB: profileIdB,
      },
    },
  })
}

/**
 * Get top matches for a profile (for recommendations).
 */
export async function getTopMatches(profileId: string, limit: number = 20) {
  return db.matchScore.findMany({
    where: {
      OR: [
        { profileIdA: profileId },
        { profileIdB: profileId },
      ],
      recommendation: { in: ['RECOMMENDED', 'POTENTIAL'] },
    },
    orderBy: { overallScore: 'desc' },
    take: limit,
  })
}
