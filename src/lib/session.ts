export interface SessionData {
  token: string
  user?: Record<string, unknown>
  [key: string]: unknown
}

const SESSION_KEY = 'bandhan-session'

export function getSession(): SessionData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.token) return parsed as SessionData
    return null
  } catch {
    return null
  }
}

export function setSession(data: SessionData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}

export function hasSession(): boolean {
  return !!getSession()?.token
}
