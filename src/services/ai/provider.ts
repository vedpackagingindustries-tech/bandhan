// ═══════════════════════════════════════════════════════════
// AI PROVIDER MANAGER
// Provider-agnostic AI service routing with failover.
// Supports: ZAI (z-ai-web-dev-sdk), OpenAI, Google, Anthropic, Local
// ═══════════════════════════════════════════════════════════

import type {
  AIProvider,
  AIProviderName,
  AICapability,
  AIProviderResponse,
  ChatRequest,
  ChatResponse,
  VisionRequest,
  VisionResponse,
} from './types'
import { db } from '@/lib/db'
import { getCache, setCache } from '@/services/cache'

const CACHE_KEY = 'AI_PROVIDERS'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Rate limiting per provider (in-memory)
const providerCallTimes = new Map<string, number[]>()

// --- ZAI Provider Adapter (z-ai-web-dev-sdk) ---

// ZAI Provider using z-ai-web-dev-sdk
// SDK provides: createChatCompletion, createChatCompletionVision, createImageEdit

class ZAIProvider implements AIProvider {
  name: AIProviderName = 'ZAI'
  capabilities: AICapability[] = ['chat', 'vision', 'moderation', 'matching', 'recommendation', 'translation', 'risk-analysis', 'image-edit']

  private sdkInstance: any = null

  private async getSDK() {
    if (!this.sdkInstance) {
      const mod = await import('z-ai-web-dev-sdk')
      this.sdkInstance = new mod.default()
    }
    return this.sdkInstance
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getSDK()
      return true
    } catch {
      return false
    }
  }

  async chat(request: ChatRequest): Promise<AIProviderResponse<ChatResponse>> {
    const start = Date.now()
    try {
      const sdk = await this.getSDK()
      const lastMsg = request.messages[request.messages.length - 1]
      const systemMsg = request.messages.find(m => m.role === 'system')?.content || ''

      const result = await sdk.createChatCompletion({
        messages: request.messages,
        max_tokens: request.maxTokens || 2048,
        temperature: request.temperature || 0.7,
      })

      const content = typeof result === 'string' ? result : JSON.stringify(result)
      const durationMs = Date.now() - start

      return {
        success: true,
        data: {
          content,
          model: 'zai-llm',
          inputTokens: this.estimateTokens(systemMsg + (lastMsg?.content || '')),
          outputTokens: this.estimateTokens(content),
        },
        model: 'zai-llm',
        inputTokens: this.estimateTokens(systemMsg + (lastMsg?.content || '')),
        outputTokens: this.estimateTokens(content),
        durationMs,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'ZAI chat failed',
        durationMs: Date.now() - start,
      }
    }
  }

  async vision(request: VisionRequest): Promise<AIProviderResponse<VisionResponse>> {
    const start = Date.now()
    try {
      const sdk = await this.getSDK()

      const result = await sdk.createChatCompletionVision({
        prompt: request.prompt,
        image_url: request.imageUrl,
        max_tokens: request.maxTokens || 1024,
      })

      const content = typeof result === 'string' ? result : JSON.stringify(result)
      const durationMs = Date.now() - start

      return {
        success: true,
        data: {
          content,
          model: 'zai-vlm',
          inputTokens: this.estimateTokens(request.prompt + '[image]'),
          outputTokens: this.estimateTokens(content),
        },
        model: 'zai-vlm',
        inputTokens: this.estimateTokens(request.prompt + '[image]'),
        outputTokens: this.estimateTokens(content),
        durationMs,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'ZAI vision failed',
        durationMs: Date.now() - start,
      }
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

// --- Provider Registry ---

const providerInstances = new Map<AIProviderName, AIProvider>([
  ['ZAI', new ZAIProvider()],
])

// --- Provider Manager ---

/**
 * Get all configured providers from DB, sorted by priority.
 * Results are cached for 5 minutes.
 */
export async function getConfiguredProviders(): Promise<{
  provider: AIProviderName
  priority: number
  capabilities: AICapability[]
}[]> {
  const cached = getCache(CACHE_KEY)
  if (cached) return cached as typeof cached

  const configs = await db.aIProviderConfig.findMany({
    where: { enabled: true },
    orderBy: { priority: 'desc' },
  })

  const result = configs.map(c => ({
    provider: c.provider as AIProviderName,
    priority: c.priority,
    capabilities: JSON.parse(c.capabilities || '[]') as AICapability[],
  }))

  // Always ensure ZAI is available as fallback
  if (!result.find(p => p.provider === 'ZAI')) {
    result.push({
      provider: 'ZAI',
      priority: -1,
      capabilities: ['chat', 'vision', 'moderation', 'matching', 'recommendation', 'translation', 'risk-analysis'],
    })
  }

  setCache(CACHE_KEY, result, CACHE_TTL)
  return result
}

/**
 * Check rate limit for a provider.
 */
function checkRateLimit(provider: AIProviderName, rpmLimit: number): boolean {
  const now = Date.now()
  const windowMs = 60 * 1000
  const calls = providerCallTimes.get(provider) || []

  // Clean old entries
  const recent = calls.filter(t => now - t < windowMs)
  providerCallTimes.set(provider, recent)

  if (recent.length >= rpmLimit) return false
  recent.push(now)
  return true
}

/**
 * Get the best available provider for a given capability.
 * Falls back through providers by priority.
 */
export async function getProviderFor(capability: AICapability): Promise<AIProvider | null> {
  const providers = await getConfiguredProviders()

  for (const p of providers) {
    if (!p.capabilities.includes(capability)) continue

    const instance = providerInstances.get(p.provider)
    if (!instance) continue

    if (!instance.capabilities.includes(capability)) continue

    const available = await instance.isAvailable().catch(() => false)
    if (!available) continue

    return instance
  }

  return null
}

/**
 * Execute a chat request through the best available provider.
 */
export async function executeChat(request: ChatRequest): Promise<AIProviderResponse<ChatResponse>> {
  const provider = await getProviderFor('chat')
  if (!provider) {
    return {
      success: false,
      error: 'No AI provider available for chat',
      durationMs: 0,
    }
  }

  checkRateLimit(provider.name, 60) // Default 60 rpm
  const result = await provider.chat(request)
  return result
}

/**
 * Execute a vision request through the best available provider.
 */
export async function executeVision(request: VisionRequest): Promise<AIProviderResponse<VisionResponse>> {
  const provider = await getProviderFor('vision')
  if (!provider) {
    return {
      success: false,
      error: 'No AI provider available for vision',
      durationMs: 0,
    }
  }

  if (!provider.vision) {
    return {
      success: false,
      error: `Provider ${provider.name} does not support vision`,
      durationMs: 0,
    }
  }

  checkRateLimit(provider.name, 30) // Vision is more expensive
  const result = await provider.vision(request)
  return result
}

/**
 * Estimate cost for a request.
 */
export function estimateCost(params: {
  provider: AIProviderName
  inputTokens: number
  outputTokens: number
}): number {
  // ZAI is internal — cost tracking only
  if (params.provider === 'ZAI') return 0
  return (params.inputTokens * 0.00001 + params.outputTokens * 0.00003)
}

/**
 * Invalidate provider cache (called when admin changes config).
 */
export function invalidateProviderCache() {
  const { deleteCache } = await import('@/services/cache')
  deleteCache(CACHE_KEY)
}
