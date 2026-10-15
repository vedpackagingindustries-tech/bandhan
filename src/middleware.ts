import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Suspicious user agents to block
const BLOCKED_USER_AGENTS = [
  'sqlmap', 'nikto', 'nmap', 'masscan', 'dirbuster',
  'gobuster', 'wfuzz', 'ffuf', 'hydra', 'burpsuite',
  'zap', 'arachni', 'w3af', 'acunetix', 'nessus',
  'openvas', 'qualys', 'rapid7',
]

// Rate limiting (in-memory, per-instance — fine for serverless)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 100 // requests
const RATE_WINDOW = 60_000 // 1 minute

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // ─── Block suspicious user agents ───
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || ''
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (userAgent.includes(blocked)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // ─── Block common attack paths ───
  const pathname = request.nextUrl.pathname
  const blockedPaths = [
    '/.env', '/.git', '/wp-admin', '/wp-login', '/xmlrpc.php',
    '/phpmyadmin', '/admin/config', '/server-status', '/.DS_Store',
    '/actuator', '/.well-known/security.txt',
  ]
  for (const blocked of blockedPaths) {
    if (pathname.startsWith(blocked)) {
      return new NextResponse('Not Found', { status: 404 })
    }
  }

  // ─── Rate limiting (API routes only) ───
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const now = Date.now()
    const entry = rateLimitMap.get(ip)

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
      response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT))
      response.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT - 1))
    } else if (entry.count >= RATE_LIMIT) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    } else {
      entry.count++
      response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT))
      response.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT - entry.count))
    }

    // Clean up old entries periodically
    if (rateLimitMap.size > 10_000) {
      for (const [key, val] of rateLimitMap) {
        if (now > val.resetAt) rateLimitMap.delete(key)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.).*)',
  ],
}
