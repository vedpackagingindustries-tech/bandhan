// ═══════════════════════════════════════════════════════════
// AI INTELLIGENCE LAYER — BARREL EXPORT
// Phase 4: Complete AI service architecture
// ═══════════════════════════════════════════════════════════

// Types
export type {
  AIProviderName, AICapability, AIOperation,
  AIProviderConfigData, AIProviderResponse, ChatMessage, ChatRequest, ChatResponse,
  VisionRequest, VisionResponse,
  MatchFactor, MatchResult, EligibilityResult,
  RecommendationType, RecommendationItem, RecommendationResult,
  ModerationVerdict, ModerationAutoAction, ModerationFlag, ModerationResult,
  PhotoQualityIssue, PhotoQualityResult,
  PhotoEditOperation, PhotoEditRequest, PhotoEditResult,
  SmartSearchParseResult,
  JobMatchResult, CandidateMatchResult,
  BusinessRecommendation, DirectoryRecommendation,
  AdminInsight, AdminCopilotResult,
  RiskLevel, RiskSignal, RiskAssessmentResult,
  ProfileSuggestion, ProfileAssistantResult,
  AssistantContext, AssistantResponse,
  AutomationWorkflowType, AutomationStep, AutomationResult,
  AIUsageRecord, AICostEstimate,
} from './types'

// Provider
export { getConfiguredProviders, getProviderFor, executeChat, executeVision, estimateCost, invalidateProviderCache } from './provider'

// Audit
export { createAIRequest, completeAIRequest, recordAIUsage, getAIAnalytics } from './audit'

// Match Engine
export { matchProfiles, getCachedMatch, getTopMatches } from './match-engine'

// Recommendations
export { getRecommendations, getMatrimonyRecommendations, getJobRecommendations, getBusinessRecommendations, getDirectoryRecommendations } from './recommendations'

// Profile Assistant
export { analyzeProfile, translateText } from './profile-assistant'

// Moderation
export { moderateImage, reviewModeration, getPendingModeration } from './moderation'

// Photo Quality
export { analyzePhotoQuality } from './photo-quality'

// Photo Editor
export { editPhoto, getMediaVersions } from './photo-editor'

// Smart Search
export { parseSmartSearch } from './smart-search'

// Job Matching
export { matchCandidateToJob, matchJobToCandidates } from './job-matching'

// Admin Copilot
export { generateAdminInsights } from './admin-copilot'

// Risk Detection
export { assessRisk, collectRegistrationSignals, collectContentRiskSignals } from './risk-detection'

// Automation
export { runRegistrationWorkflow, runContentWorkflow } from './automation'

// Assistant
export { assistantChat } from './assistant'
