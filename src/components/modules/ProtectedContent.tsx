'use client'

// ═══════════════════════════════════════════════════════════════
// Screenshot/scratch deterrence wrapper for sensitive listing views.
// - Dynamic user-specific watermark overlay (id + phone tail)
// - Text selection disabled
// - Right-click deterrent
// NOTE (honest limitation): browsers cannot truly prevent screenshots,
// camera capture or devtools. The REAL protection is that private
// phone/email never reach the browser at all (API-layer stripping).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { getSession } from '@/lib/session'

export function ProtectedContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [now, setNow] = useState('')
  const session = typeof window !== 'undefined' ? getSession() : null
  const watermark = useMemo(() => {
    const u = (session?.user ?? {}) as { phone?: string; profile?: { firstName?: string } }
    const phone = u.phone
    const name = u.profile?.firstName ?? ''
    const idTail = session?.token ? session.token.slice(-6).toUpperCase() : 'GUEST'
    return `${name ? name + ' · ' : ''}${phone ? '•••• ' + phone.slice(-4) + ' · ' : ''}${idTail}`
  }, [session])

  useEffect(() => {
    setNow(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }))
  }, [])

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-allow-context-menu]')) return
      e.preventDefault()
    }
    document.addEventListener('contextmenu', onContextMenu)
    return () => document.removeEventListener('contextmenu', onContextMenu)
  }, [])

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
      {/* Repeating diagonal watermark overlay (pointer-transparent) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
              `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='140'><text x='10' y='60' font-size='13' fill='%237c2d12' transform='rotate(-24 10 60)' font-family='sans-serif'>${watermark}</text><text x='130' y='130' font-size='13' fill='%237c2d12' transform='rotate(-24 130 130)' font-family='sans-serif'>${now}</text></svg>`
            )}")`,
            backgroundRepeat: 'repeat',
          }}
        />
      </div>
    </div>
  )
}
