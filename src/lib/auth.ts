import { scrypt, randomBytes, randomInt, timingSafeEqual, createHmac } from 'crypto'
import { promisify } from 'util'
import { checkRateLimit as kvCheckRateLimit } from '@/lib/rate-limit'

const scryptAsync = promisify(scrypt)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':')
  if (!salt || !key) return false
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return timingSafeEqual(Buffer.from(key, 'hex'), derivedKey)
}

export function generateToken(length = 32): string {
  return randomBytes(length).toString('hex')
}

/** Cryptographically secure OTP using crypto.randomInt */
export function generateOTP(length = 6): string {
  let otp = ''
  for (let i = 0; i < length; i++) {
    otp += randomInt(0, 10).toString()
  }
  return otp
}

/** Hash OTP for secure storage — returns HMAC-SHA256 hex digest */
export function hashOTP(otp: string): string {
  const secret = process.env.OTP_HASH_SECRET
  if (!secret) {
    throw new Error('OTP_HASH_SECRET env var is required. Set it in .env for security.')
  }
  return createHmac('sha256', secret).update(otp).digest('hex')
}

/** Timing-safe OTP comparison */
export function verifyOTPCode(inputOtp: string, storedHash: string): boolean {
  const inputHash = hashOTP(inputOtp)
  const a = Buffer.from(inputHash, 'utf8')
  const b = Buffer.from(storedHash, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function generateSessionToken(): string {
  return randomBytes(48).toString('hex')
}

// ═══════════════════════════════════════════════════════════
// PERSISTENT RATE LIMITING
// Uses Vercel KV (Redis) for multi-instance, persistent limits.
// Falls back to in-memory if KV is not configured.
// ═══════════════════════════════════════════════════════════

/**
 * Check rate limit using persistent KV store.
 * This is the app-level rate limiter (not edge middleware).
 * Uses Vercel KV for production, in-memory fallback for dev.
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 5,
  windowMs: number = 60 * 1000
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const result = await kvCheckRateLimit(`auth:${identifier}`, maxRequests, windowMs)
  if (!result.allowed) {
    return { allowed: false, retryAfterMs: result.resetAt - Date.now() }
  }
  return { allowed: true }
}
