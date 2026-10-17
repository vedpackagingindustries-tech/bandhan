// ═══════════════════════════════════════════════════════════
// TOTP 2FA IMPLEMENTATION
// Time-based One-Time Password for admin accounts
// RFC 6238 compliant using HMAC-SHA1
// ═══════════════════════════════════════════════════════════

import { createHmac, randomBytes } from 'crypto'

// Base32 encoding/decoding for TOTP (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let result = ''
  let bits = 0
  let value = 0

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31]
  }

  return result
}

function base32Decode(str: string): Buffer {
  str = str.toUpperCase().replace(/=+$/, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (const char of str) {
    const idx = BASE32_CHARS.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

/**
 * Generate a new TOTP secret (Base32 encoded)
 */
export function generateTOTPSecret(): string {
  const bytes = randomBytes(20)
  return base32Encode(bytes)
}

/**
 * Generate TOTP code from secret and timestamp
 */
export function generateTOTPCode(secret: string, timestamp?: number): string {
  const timeStep = Math.floor((timestamp || Date.now()) / 30000)
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(0, 0) // high 32 bits (timeStep fits in 32 bits for ~1000 years)
  buffer.writeUInt32BE(timeStep, 4)

  const key = base32Decode(secret)
  const hmac = createHmac('sha1', key).update(buffer).digest()

  const offset = hmac[hmac.length - 1] & 0x0f
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000

  return code.toString().padStart(6, '0')
}

/**
 * Verify a TOTP code against a secret
 * Allows ±1 time step (30s window each side) for clock drift
 */
export function verifyTOTP(secret: string, code: string): boolean {
  const now = Date.now()

  for (let offset = -1; offset <= 1; offset++) {
    const adjustedTime = now + offset * 30000
    const expectedCode = generateTOTPCode(secret, adjustedTime)
    if (timingSafeEqual(code, expectedCode)) {
      return true
    }
  }

  return false
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Generate otpauth:// URI for QR code
 */
export function getTOTPUri(secret: string, email: string): string {
  const issuer = encodeURIComponent('Bandhan Sahu Samaj')
  const account = encodeURIComponent(email)
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}

/**
 * Generate backup/recovery codes (single-use)
 */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = randomBytes(5).toString('hex').toUpperCase()
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`)
  }
  return codes
}
