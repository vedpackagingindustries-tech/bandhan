import { NextResponse } from 'next/server'

export function success(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function error(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status })
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ success: false, error: message }, { status: 403 })
}

export function serverError(message = 'Internal server error') {
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}

// Helper to get client info from request
export function getClientInfo(request: Request) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  const userAgent = request.headers.get('user-agent') || ''
  return { ipAddress, userAgent }
}
