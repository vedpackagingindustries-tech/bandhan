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
