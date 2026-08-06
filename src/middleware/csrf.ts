// ═══════════════════════════════════════════════════════════
// CSRF PROTECTION
// Double-submit cookie pattern for API routes.
// Stateless — no server-side session storage needed.
// ═══════════════════════════════════════════════════════════

import { randomUUID, timingSafeEqual } from 'crypto'

/**
 * Generate a CSRF token.
 * In production, this would be set as a non-httponly cookie
 * and the frontend would include it in a custom header.
 */
export function generateCsrfToken(): string {
  return randomUUID().replace(/-/g, '')
}

/**
 * Validate CSRF token from request.
 * Checks the X-CSRF-Token header against the expected value.
 * For foundation phase: validates that the header is present.
 * Production: compare against cookie-based token.
 */
export function validateCsrfToken(request: Request): boolean {
  const token = request.headers.get('x-csrf-token')
  const csrfCookie = request.headers.get('x-csrf-cookie')

  // Double-submit pattern: header must match cookie
  if (token && csrfCookie) {
    return timingSafeEqualStrings(token, csrfCookie)
  }

  // Foundation fallback: token presence check
  return !!token
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return timingSafeEqual(aBuf, bBuf)
}

/**
 * CSRF middleware for Next.js API routes.
 * Call at the start of mutating endpoints (POST/PUT/PATCH/DELETE).
 */
export function csrfGuard(request: Request): { valid: boolean; error?: string } {
  const method = request.method
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']

  // Safe methods don't need CSRF protection
  if (safeMethods.includes(method)) {
    return { valid: true }
  }

  if (!validateCsrfToken(request)) {
    return { valid: false, error: 'CSRF token validation failed' }
  }

  return { valid: true }
}
