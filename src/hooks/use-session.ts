'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import { getSession, setSession as storeSession, clearSession, type SessionData } from '@/lib/session'

const emptySession = null

function subscribeToSession(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'bandhan-session') callback()
  }
  const onCustom = () => callback()
  window.addEventListener('storage', onStorage)
  window.addEventListener('bandhan-session-change', onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('bandhan-session-change', onCustom)
  }
}

function getSnapshot(): SessionData | null {
  return getSession()
}

function getServerSnapshot(): null {
  return null
}

export function useSession() {
  const session = useSyncExternalStore(subscribeToSession, getSnapshot, getServerSnapshot)

  const login = useCallback((data: SessionData) => {
    storeSession(data)
    window.dispatchEvent(new Event('bandhan-session-change'))
  }, [])

  const logout = useCallback(() => {
    // Server-side session invalidation first (best-effort) — otherwise the
    // token stays valid in DB until expiry even after the user "logs out".
    const current = getSession()
    if (current?.token) {
      fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${current.token}` },
      }).catch(() => {})
    }
    clearSession()
    window.dispatchEvent(new Event('bandhan-session-change'))
  }, [])

  return {
    session,
    isLoggedIn: !!session?.token,
    login,
    logout,
  }
}
