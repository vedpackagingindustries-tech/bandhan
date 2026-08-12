// ═══════════════════════════════════════════════════════════
// AI INTELLIGENCE LAYER — TYPE DEFINITIONS
// Phase 4: Production AI Service Architecture
// ═══════════════════════════════════════════════════════════

// --- Provider Types ---

export type AIProviderName = 'ZAI' | 'OPENAI' | 'GOOGLE' | 'ANTHROPIC' | 'LOCAL'

export type AICapability =
  | 'chat'
  | 'vision'
  | 'moderation'
  | 'matching'
  | 'recommendation'
  | 'translation'
  | 'image-edit'
  | 'risk-analysis'

export type AIOperation =
  | 'MATCH'
  | 'MODERATE'
  | 'RECOMMEND'
  | 'ASSIST'
  | 'TRANSLATE'
  | 'ANALYZE'
  | 'EDIT'
  | 'SMART_SEARCH'
  | 'JOB_MATCH'
  | 'BUSINESS_REC'
  | 'DIRECTORY_REC'
  | 'ADMIN_COPILOT'
  | 'RISK_ANALYSIS'
  | 'PROFILE_ASSIST'

// --- Provider Interface ---

export interface AIProviderConfigData {
  provider: AIProviderName
  displayName: string
  description?: string
  enabled: boolean
  config: {
    apiKey?: string
    baseUrl?: string
    model?: string
    maxTokens?: number
    temperature?: number
    [key: string]: unknown
  }
  capabilities: AICapability[]
  priority: number
  rateLimitRpm: number
  costPer1kTok: number
}

export interface AIProviderResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  durationMs: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
}

export interface ChatResponse {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
}

export interface VisionRequest {
  imageUrl: string
  prompt: string
  maxTokens?: number
}

export interface VisionResponse {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
}

// --- Provider Adapters ---

export interface AIProvider {
  name: AIProviderName
  capabilities: AICapability[]
  chat(request: ChatRequest): Promise<AIProviderResponse<ChatResponse>>
  vision?(request: VisionRequest): Promise<AIProviderResponse<VisionResponse>>
  isAvailable(): Promise<boolean>
}

// --- Match Types ---

export interface MatchFactor {
  name: string
  weight: number
  score: number  // 0-100 for this factor
  matched: boolean
  details: string
}

export interface MatchResult {
  profileIdA: string
  profileIdB: string
  overallScore: number
  factors: MatchFactor[]
  positiveFactors: string[]
  potentialDifferences: string[]
  explanation: string
  recommendation: 'RECOMMENDED' | 'POTENTIAL' | 'NOT_RECOMMENDED'
  confidence: number
}

export interface EligibilityResult {
  eligible: boolean
  reasons: string[]
}

// --- Recommendation Types ---

export type RecommendationType = 'MATRIMONY' | 'JOB' | 'BUSINESS' | 'DIRECTORY'

export interface RecommendationItem {
  id: string
  score: number
  reason: string
  reasonHi: string
  factors: { name: string; weight: number; matched: boolean }[]
 data?: Record<string, unknown>
}

export interface RecommendationResult {
  items: RecommendationItem[]
  total: number
  type: RecommendationType
}

// --- Moderation Types ---

export type ModerationVerdict = 'SAFE' | 'REVIEW' | 'BLOCKED'
export type ModerationAutoAction = 'NONE' | 'BLUR' | 'HIDE' | 'FLAG_FOR_REVIEW'

export interface ModerationFlag {
  category: string
  confidence: number
  description: string
}

export interface ModerationResult {
  mediaId: string
  verdict: ModerationVerdict
  confidence: number
  flags: ModerationFlag[]
  autoAction: ModerationAutoAction
}

// --- Photo Quality Types ---

export interface PhotoQualityIssue {
  type: 'BLUR' | 'LOW_RESOLUTION' | 'POOR_LIGHTING' | 'OBSTRUCTION' | 'DUPLICATE' | 'INVALID_PROFILE_IMAGE'
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  description: string
  descriptionHi: string
}

export interface PhotoQualityResult {
  mediaId: string
  overallQuality: 'GOOD' | 'ACCEPTABLE' | 'POOR'
  issues: PhotoQualityIssue[]
  recommendations: string[]
  recommendationsHi: string[]
}

// --- Photo Editor Types ---

export type PhotoEditOperation =
  | 'BACKGROUND_CLEANUP'
  | 'LIGHTING_ENHANCE'
  | 'RESOLUTION_ENHANCE'
  | 'CROP_ASSIST'
  | 'PROFESSIONAL_FRAMING'

export interface PhotoEditRequest {
  mediaId: string
  operations: PhotoEditOperation[]
}

export interface PhotoEditResult {
  originalMediaId: string
  newMediaId: string
  operations: PhotoEditOperation[]
 status: 'COMPLETED' | 'PARTIAL' | 'FAILED'
}

// --- Smart Search Types ---

export interface SmartSearchParseResult {
  filters: Record<string, unknown>
  query: string
  intent: 'MATRIMONY' | 'BUSINESS' | 'JOB' | 'DIRECTORY' | 'GENERAL'
  language: 'en' | 'hi'
  confidence: number
}

// --- Job Match Types ---

export interface JobMatchResult {
  jobId: string
  candidateId: string
  score: number
  matchingSkills: string[]
  missingSkills: string[]
  explanation: string
}

export interface CandidateMatchResult {
  candidateId: string
  jobId: string
  score: number
  matchingSkills: string[]
  missingSkills: string[]
  explanation: string
}

// --- Business/Directory Recommendation Types ---

export interface BusinessRecommendation {
  businessId: string
  score: number
  reason: string
  reasonHi: string
  isSponsored: boolean
}

export interface DirectoryRecommendation {
  directoryId: string
  score: number
  reason: string
  reasonHi: string
}

// --- Admin Copilot Types ---

export interface AdminInsight {
  category: string
  title: string
  titleHi: string
  description: string
  descriptionHi: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  actionRequired: boolean
  suggestedAction?: string
  data?: Record<string, unknown>
}

export interface AdminCopilotResult {
  insights: AdminInsight[]
  summary: string
  summaryHi: string
}

// --- Risk Detection Types ---

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface RiskSignal {
  type: string
  description: string
  weight: number
}

export interface RiskAssessmentResult {
  riskLevel: RiskLevel
  riskScore: number
  signals: RiskSignal[]
  actionSuggested: 'NONE' | 'MONITOR' | 'FLAG_FOR_REVIEW' | 'NOTIFY_ADMIN'
}

// --- Profile Assistant Types ---

export interface ProfileSuggestion {
  field: string
  currentValue: string
  suggestion: string
  suggestionHi: string
  reason: string
  reasonHi: string
}

export interface ProfileAssistantResult {
  suggestions: ProfileSuggestion[]
  completenessScore: number
  missingFields: string[]
  improvedAboutMe?: string
  improvedAboutMeHi?: string
}

// --- AI Assistant Types ---

export interface AssistantContext {
  userId: string
  locale: 'en' | 'hi'
  membershipTier: string
  userName?: string
  module?: string
}

export interface AssistantResponse {
  response: string
  responseHi: string
  module?: string
  action?: {
    type: string
    data: Record<string, unknown>
  }
  sources?: string[]
}

// --- Automation Types ---

export type AutomationWorkflowType =
  | 'REGISTRATION'
  | 'ADVERTISEMENT'
  | 'JOB_POSTING'
  | 'BUSINESS_LISTING'
  | 'MATRIMONY_PROFILE'
  | 'DIRECTORY_LISTING'

export interface AutomationStep {
  step: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  result?: string
  durationMs?: number
}

export interface AutomationResult {
  workflowType: AutomationWorkflowType
  targetId: string
  steps: AutomationStep[]
  finalStatus: 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'FLAGGED'
  humanReviewRequired: boolean
  reviewReason?: string
}

// --- Usage & Analytics ---

export interface AIUsageRecord {
  date: string
  operation: AIOperation
  provider: AIProviderName
  model?: string
  totalRequests: number
  successCount: number
  failCount: number
  totalInputTok: number
  totalOutputTok: number
  totalCostUsd: number
  avgLatencyMs: number
}

export interface AICostEstimate {
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  provider: AIProviderName
  model?: string
}
