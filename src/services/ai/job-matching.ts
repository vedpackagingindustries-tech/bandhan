// ═══════════════════════════════════════════════════════════
// AI JOB MATCHING
// For candidates: recommend suitable jobs.
// For employers: recommend suitable candidates.
// Employer remains responsible for hiring decisions.
// ═══════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import type { JobMatchResult, CandidateMatchResult } from './types'
import { createAIRequest, completeAIRequest, recordAIUsage } from './audit'

/**
 * Match a candidate to a specific job.
 */
export async function matchCandidateToJob(params: {
  candidateId: string
  jobId: string
  userId?: string
}): Promise<JobMatchResult> {
  const startMs = Date.now()

  const [profile, job] = await Promise.all([
    db.profile.findUnique({
      where: { userId: params.candidateId },
      select: { id: true, education: true, occupation: true, city: true, state: true, bio: true },
    }),
    db.job.findUnique({
      where: { id: params.jobId },
      select: { id: true, title: true, description: true, category: true, type: true, skills: true, education: true, salaryMin: true, salaryMax: true, location: true, isRemote: true },
    }),
  ])

  if (!profile || !job) {
    return { jobId: params.jobId, candidateId: params.candidateId, score: 0, matchingSkills: [], missingSkills: [], explanation: 'Profile or job not found' }
  }

  const jobSkills = Array.isArray(job.skills) ? job.skills.map(String).map(s => s.toLowerCase()) : []
  const profileKeywords = [
    profile.occupation, profile.education, profile.bio, profile.city, profile.state,
  ].filter(Boolean).join(' ').toLowerCase().split(/[\n,;\s]+/)

  // Deterministic skill matching
  const matchingSkills: string[] = []
  const missingSkills: string[] = []

  for (const skill of jobSkills) {
    if (profileKeywords.some(k => k.includes(skill) || skill.includes(k))) {
      matchingSkills.push(skill)
    } else {
      missingSkills.push(skill)
    }
  }

  // Education match
  let eduScore = 0
  if (job.education && profile.education) {
    if (profile.education.toLowerCase().includes(job.education.toLowerCase()) || job.education.toLowerCase().includes(profile.education.toLowerCase())) {
      eduScore = 30
    }
  }

  // Location match
  let locScore = 0
  if (job.isRemote) {
    locScore = 25
  } else if (job.location && profile.city && job.location.toLowerCase().includes(profile.city.toLowerCase())) {
    locScore = 25
  } else if (job.location && profile.state && job.location.toLowerCase().includes(profile.state.toLowerCase())) {
    locScore = 15
  }

  const skillScore = jobSkills.length > 0 ? (matchingSkills.length / jobSkills.length) * 45 : 20
  const totalScore = Math.min(100, Math.round(skillScore + eduScore + locScore))

  const explanation = totalScore >= 70
    ? `Strong match based on ${matchingSkills.length} matching skills out of ${jobSkills.length} required.`
    : totalScore >= 40
      ? `Partial match: ${matchingSkills.length}/${jobSkills.length} skills match. Consider upskilling in: ${missingSkills.join(', ')}.`
      : `Limited match. Missing key skills: ${missingSkills.join(', ')}.`

  await recordAIUsage({
    operation: 'JOB_MATCH', provider: 'ZAI', model: 'job-match-v1',
    success: true, latencyMs: Date.now() - startMs,
  })

  return { jobId: params.jobId, candidateId: params.candidateId, score: totalScore, matchingSkills, missingSkills, explanation }
}

/**
 * Match candidates to a job (for employer view).
 */
export async function matchJobToCandidates(params: {
  jobId: string
  limit?: number
}): Promise<CandidateMatchResult[]> {
  const limit = params.limit || 20

  const applications = await db.jobApplication.findMany({
    where: { jobId: params.jobId },
    include: {
      candidate: { select: { id: true, profile: { select: { education: true, occupation: true, city: true, state: true, bio: true } } } },
    },
    take: limit,
  })

  const results: CandidateMatchResult[] = []
  for (const app of applications) {
    const match = await matchCandidateToJob({ candidateId: app.candidateId, jobId: params.jobId })
    results.push({
      candidateId: app.candidateId,
      jobId: params.jobId,
      score: match.score,
      matchingSkills: match.matchingSkills,
      missingSkills: match.missingSkills,
      explanation: match.explanation,
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
