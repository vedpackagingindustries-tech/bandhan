import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════
// BANDHAN EDGE MIDDLEWARE
// Security: rate limiting, bot blocking, anti-scraping, CSRF origin check
// Rate limiting: Vercel KV (persistent) + in-memory fallback
// ═══════════════════════════════════════════════════════════

// Suspicious user agents to block
const BLOCKED_USER_AGENTS = [
  'sqlmap', 'nikto', 'nmap', 'masscan', 'dirbuster',
  'gobuster', 'wfuzz', 'ffuf', 'hydra', 'burpsuite',
  'zap', 'arachni', 'w3af', 'acunetix', 'nessus',
  'openvas', 'qualys', 'rapid7',
  // Scraping / data extraction tools
  'scrapy', 'beautifulsoup', 'selenium', 'puppeteer',
  'playwright', 'cheerio', 'httpclient', 'python-requests',
  'python-urllib', 'java/', 'go-http-client', 'ruby',
  'perl', 'curl/', 'wget/', 'httpie',
]

// Allowed origins for same-origin policy on mutating requests
const ALLOWED_ORIGINS = [
  'https://bandhan-sahu-connect.vercel.app',
  'http://localhost:3000',
]

// Anti-scraping: Track request patterns per IP (in-memory for edge)
const scrapeTracker = new Map<string, { count: number; firstAt: number; paths: Set<string> }>()
const SCRAPE_THRESHOLD = 50
const SCRAPE_WINDOW = 300_000

// Rate limiting (in-memory edge fallback — KV used in app-level)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 100
const RATE_WINDOW = 60_000

const authRateLimitMap = new Map<string, { count: number; resetAt: number }>()
const AUTH_RATE_LIMIT = 10
const AUTH_RATE_WINDOW = 60_000

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname
  const method = request.method
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || ''
  const now = Date.now()

  // ─── 1. Block suspicious user agents ───
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (userAgent.includes(blocked)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // ─── 2. Block empty user-agent on API routes ───
  if (pathname.startsWith('/api/') && !userAgent) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // ─── 3. Block common attack paths ───
  const blockedPaths = [
    '/.env', '/.env.local', '/.env.production', '/.git', '/wp-admin', '/wp-login',
    '/xmlrpc.php', '/phpmyadmin', '/admin/config', '/server-status', '/.DS_Store',
    '/actuator', '/.well-known/security.txt', '/backup', '/dump', '/export',
  ]
  for (const blocked of blockedPaths) {
    if (pathname.startsWith(blocked)) {
      return new NextResponse('Not Found', { status: 404 })
    }
  }

  // ─── 4. CSRF origin check on mutating API requests ───
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const origin = request.headers.get('origin')

    // Auth routes require valid origin
    if (pathname.startsWith('/api/v1/auth/')) {
      if (!origin) {
        return new NextResponse(
          JSON.stringify({ success: false, error: 'Origin header required' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (!ALLOWED_ORIGINS.includes(origin)) {
        return new NextResponse(
          JSON.stringify({ success: false, error: 'Invalid origin' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // If origin present, verify it
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Invalid origin' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // ─── 5. API Rate limiting (edge in-memory) ───
  if (pathname.startsWith('/api/')) {
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

    if (rateLimitMap.size > 10_000) {
      for (const [key, val] of rateLimitMap) {
        if (now > val.resetAt) rateLimitMap.delete(key)
      }
    }
  }

  // ─── 6. Stricter auth endpoint rate limiting ───
  if (pathname.startsWith('/api/v1/auth/')) {
    const authKey = `${ip}:auth`
    const authEntry = authRateLimitMap.get(authKey)

    if (!authEntry || now > authEntry.resetAt) {
      authRateLimitMap.set(authKey, { count: 1, resetAt: now + AUTH_RATE_WINDOW })
    } else if (authEntry.count >= AUTH_RATE_LIMIT) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Too many auth attempts. Please wait.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((authEntry.resetAt - now) / 1000)),
          },
        }
      )
    } else {
      authEntry.count++
    }

    if (authRateLimitMap.size > 5_000) {
      for (const [key, val] of authRateLimitMap) {
        if (now > val.resetAt) authRateLimitMap.delete(key)
      }
    }
  }

  // ─── 7. Anti-scraping detection ───
  if (pathname.startsWith('/api/')) {
    const tracker = scrapeTracker.get(ip)
    if (!tracker || now - tracker.firstAt > SCRAPE_WINDOW) {
      scrapeTracker.set(ip, { count: 1, firstAt: now, paths: new Set([pathname]) })
    } else {
      tracker.paths.add(pathname)
      tracker.count++
      if (tracker.paths.size >= SCRAPE_THRESHOLD) {
        return new NextResponse(
          JSON.stringify({ success: false, error: 'Suspicious activity detected' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    if (scrapeTracker.size > 5_000) {
      for (const [key, val] of scrapeTracker) {
        if (now - val.firstAt > SCRAPE_WINDOW) scrapeTracker.delete(key)
      }
    }
  }

  // ─── 8. Request ID ───
  response.headers.set('X-Request-Id', `${now}-${ip.slice(0, 8)}`)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.).*)',
  ],
}
