// ═══════════════════════════════════════════════════════════
// INPUT VALIDATION UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Sanitize string: trim and remove potential script tags.
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+on\w+\s*=/gi, '')
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate Indian phone number (10 digits, optional +91 prefix).
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '')
  return cleaned.length === 10
}

/**
 * Validate OTP (6 digits).
 */
export function isValidOTP(otp: string): boolean {
  return /^\d{6}$/.test(otp)
}

/**
 * Validate password strength (min 8 chars, 1 uppercase, 1 digit).
 */
export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < 8) errors.push('Password must be at least 8 characters')
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter')
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one digit')
  return { valid: errors.length === 0, errors }
}

/**
 * Validate pagination parameters.
 */
export function isValidPagination(page: number, limit: number): boolean {
  return Number.isInteger(page) && Number.isInteger(limit) && page >= 1 && limit >= 1 && limit <= 100
}

/**
 * Validate enum value against allowed values.
 */
export function isValidEnum<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value)
}

/**
 * Sanitize object: only keep whitelisted string/number/boolean fields.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  input: Record<string, unknown>,
  allowedFields: string[]
): Partial<T> {
  const result: Partial<T> = {}
  for (const field of allowedFields) {
    if (input[field] !== undefined && input[field] !== null) {
      const val = input[field]
      if (typeof val === 'string') {
        (result as Record<string, unknown>)[field] = sanitizeString(val)
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        (result as Record<string, unknown>)[field] = val
      }
    }
  }
  return result
}

/**
 * Strip HTML tags from a string.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}

/**
 * Validate URL format.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Limit string length.
 */
export function limitLength(input: string, max: number): string {
  if (input.length <= max) return input
  return input.substring(0, max)
}
