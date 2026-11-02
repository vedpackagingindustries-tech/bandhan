import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════════
// BANDHAN PRICING & PAYMENT CONFIGURATION — Single Source of Truth
// All prices are admin-configurable via SystemConfiguration.
// Entitlements are NEVER mixed between modules.
// ═══════════════════════════════════════════════════════════════

export type ModuleKey = 'MATRIMONY' | 'BUSINESS' | 'JOBS' | 'DIRECTORY' | 'HERO_AD'
export type PaymentCategory =
  | 'MATRIMONY_PREMIUM'
  | 'BUSINESS_PREMIUM'
  | 'JOBS_PREMIUM'
  | 'DIRECTORY_REGISTRATION'
  | 'HERO_ADVERTISEMENT'
  | 'OTHER'

export interface PlanConfig {
  name: string // MONTHLY | QUARTERLY | HALFYEARLY | YEARLY | ONETIME
  label: string
  days: number | null
  price: number
  description?: string
}

export interface ModulePricing {
  module: ModuleKey
  category: PaymentCategory
  freeListingDays: number
  trial: { enabled: boolean; days: number } | null
  plans: PlanConfig[]
  oneTimeOnly?: boolean
}

// ── Master-command prices (defaults; admin can change via dashboard) ──
export const DEFAULT_PRICING: Record<ModuleKey, ModulePricing> = {
  MATRIMONY: {
    module: 'MATRIMONY',
    category: 'MATRIMONY_PREMIUM',
    freeListingDays: 5,
    trial: { enabled: true, days: 7 },
    plans: [
      { name: 'MONTHLY', label: '1 Month', days: 30, price: 250 },
      { name: 'QUARTERLY', label: '3 Months', days: 90, price: 600 },
      { name: 'HALFYEARLY', label: '6 Months', days: 180, price: 1500 },
      { name: 'YEARLY', label: '1 Year', days: 365, price: 2500 },
    ],
  },
  BUSINESS: {
    module: 'BUSINESS',
    category: 'BUSINESS_PREMIUM',
    freeListingDays: 5,
    trial: { enabled: true, days: 7 },
    plans: [
      { name: 'MONTHLY', label: '1 Month', days: 30, price: 900 },
      { name: 'QUARTERLY', label: '3 Months', days: 90, price: 1000 },
      { name: 'HALFYEARLY', label: '6 Months', days: 180, price: 3000 },
      { name: 'YEARLY', label: '1 Year', days: 365, price: 9900 },
    ],
  },
  JOBS: {
    module: 'JOBS',
    category: 'JOBS_PREMIUM',
    freeListingDays: 5,
    trial: { enabled: true, days: 7 },
    // Jobs pricing is fully admin-configurable. Defaults below are initial
    // values set by the platform — admins change them in Master Settings.
    plans: [
      { name: 'MONTHLY', label: '1 Month', days: 30, price: 300 },
      { name: 'QUARTERLY', label: '3 Months', days: 90, price: 800 },
      { name: 'HALFYEARLY', label: '6 Months', days: 180, price: 1500 },
      { name: 'YEARLY', label: '1 Year', days: 365, price: 5000 },
    ],
  },
  DIRECTORY: {
    module: 'DIRECTORY',
    category: 'DIRECTORY_REGISTRATION',
    freeListingDays: 0,
    trial: null,
    oneTimeOnly: true,
    plans: [{ name: 'ONETIME', label: 'One-time Registration', days: null, price: 250 }],
  },
  HERO_AD: {
    module: 'HERO_AD',
    category: 'HERO_ADVERTISEMENT',
    freeListingDays: 0,
    trial: null,
    plans: [
      { name: 'MONTHLY', label: '1 Month', days: 30, price: 1000 },
      { name: 'QUARTERLY', label: '3 Months', days: 90, price: 2500 },
      { name: 'HALFYEARLY', label: '6 Months', days: 180, price: 4500 },
      { name: 'YEARLY', label: '1 Year', days: 365, price: 10000 },
    ],
  },
}

export const CONFIG_KEYS: Record<string, string> = {
  MATRIMONY: 'pricing.matrimony',
  BUSINESS: 'pricing.business',
  JOBS: 'pricing.jobs',
  DIRECTORY: 'pricing.directory',
  HERO_AD: 'pricing.heroAd',
  UPI_ID: 'payment.upiId',
  UPI_NAME: 'payment.upiName',
  MAINTENANCE: 'platform.maintenanceMode',
}

// Centralized UPI ID — master command requirement
export const DEFAULT_UPI_ID = '9301056006'
export const DEFAULT_UPI_NAME = 'BANDHAN'

const PUBLIC_MODULES: ModuleKey[] = ['MATRIMONY', 'BUSINESS', 'JOBS', 'DIRECTORY']

/** Server-side: fetch effective pricing for a module (config override → default) */
export async function getModulePricing(module: ModuleKey): Promise<ModulePricing> {
  const fallback = DEFAULT_PRICING[module]
  try {
    const cfg = await db.systemConfiguration.findUnique({ where: { key: CONFIG_KEYS[module] } })
    if (cfg?.value) {
      const parsed = JSON.parse(cfg.value)
      return {
        ...fallback,
        ...parsed,
        module,
        category: fallback.category,
        plans: Array.isArray(parsed.plans) && parsed.plans.length > 0 ? parsed.plans : fallback.plans,
      }
    }
  } catch (e) {
    console.error('[PRICING] config read failed, using defaults:', e)
  }
  return fallback
}

/** Public pricing for all customer-facing modules */
export async function getPublicPricing(): Promise<{
  matrimony: ModulePricing
  business: ModulePricing
  jobs: ModulePricing
  directory: ModulePricing
  upiId: string
}> {
  const [matrimony, business, jobs, directory, upiId] = await Promise.all([
    getModulePricing('MATRIMONY'),
    getModulePricing('BUSINESS'),
    getModulePricing('JOBS'),
    getModulePricing('DIRECTORY'),
    getUpiId(),
  ])
  return { matrimony, business, jobs, directory, upiId }
}

/** Server-side only: the centralized receiving UPI ID (admin-controlled) */
export async function getUpiId(): Promise<string> {
  try {
    const cfg = await db.systemConfiguration.findUnique({ where: { key: CONFIG_KEYS.UPI_ID } })
    if (cfg?.value && cfg.value.trim()) return cfg.value.trim()
  } catch { /* fall through to default */ }
  return DEFAULT_UPI_ID
}

export async function getUpiName(): Promise<string> {
  try {
    const cfg = await db.systemConfiguration.findUnique({ where: { key: CONFIG_KEYS.UPI_NAME } })
    if (cfg?.value && cfg.value.trim()) return cfg.value.trim()
  } catch { /* default */ }
  return DEFAULT_UPI_NAME
}

/**
 * Build the UPI deep link for the centralized payment.
 * Customers CANNOT change the receiving UPI ID — it is fetched server-side.
 * Format: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&tr=<ref>&cu=INR&tn=<note>
 */
export function buildUpiLink(opts: {
  upiId: string
  payeeName: string
  amount: number
  txnRef: string
  note: string
}): string {
  const params = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payeeName.slice(0, 40),
    am: opts.amount.toFixed(2),
    tr: opts.txnRef.slice(0, 35),
    cu: 'INR',
    tn: opts.note.slice(0, 50),
  })
  return `upi://pay?${params.toString()}`
}

export function isValidCategory(category: string, module?: string): boolean {
  const valid: PaymentCategory[] = [
    'MATRIMONY_PREMIUM', 'BUSINESS_PREMIUM', 'JOBS_PREMIUM',
    'DIRECTORY_REGISTRATION', 'HERO_ADVERTISEMENT', 'OTHER',
  ]
  return valid.includes(category as PaymentCategory)
}

export function planAmount(pricing: ModulePricing, planName: string): PlanConfig | null {
  return pricing.plans.find((p) => p.name === planName) ?? null
}

export { PUBLIC_MODULES }
