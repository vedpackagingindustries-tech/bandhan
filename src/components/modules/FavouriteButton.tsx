'use client'

// ═══════════════════════════════════════════════════════════════
// Favourite heart button — max 5 per module enforced server-side.
// Hindi error messages surface when the limit is reached.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'

interface Props {
  module: string // matrimony | business | jobs
  listingId: string
  onAuthRequired?: () => void
  onLimitReached?: (msg: string) => void
}

const API_MODULE: Record<string, string> = { matrimony: 'MATRIMONY', business: 'BUSINESS', jobs: 'JOBS' }

export function FavouriteButton({ module, listingId, onAuthRequired, onLimitReached }: Props) {
  const [favId, setFavId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiGet<{ items: Array<{ id: string; listingId: string; module: string }> }>('/favourites', { module: API_MODULE[module], limit: 5 })
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          const existing = res.data.items.find((i) => i.listingId === listingId)
          setFavId(existing?.id ?? null)
        }
        setReady(true)
      })
      .catch(() => !cancelled && setReady(true))
    return () => { cancelled = true }
  }, [module, listingId])

  const toggle = async () => {
    setLoading(true)
    if (favId) {
      const res = await apiDelete(`/favourites?id=${favId}`)
      if (res.ok) setFavId(null)
    } else {
      const res = await apiPost<{ favourite: { id: string } }>('/favourites', {
        module: API_MODULE[module],
        listingId,
      })
      if (res.ok) {
        setFavId(res.data.favourite.id)
      } else {
        onLimitReached?.(res.error)
      }
    }
    setLoading(false)
  }

  const handleClick = () => {
    if (onAuthRequired) {
      // Let the parent decide auth; but favourites require login
      toggle()
      return
    }
    toggle()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || !ready}
      aria-label={favId ? 'Remove from favourites' : 'Add to favourites'}
      title={favId ? 'पसंदीदा से हटाएं' : 'पसंदीदा में जोड़ें (अधिकतम 5)'}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 ${
        favId
          ? 'border-burgundy/20 bg-burgundy/10'
          : 'border-border/40 bg-white hover:border-burgundy/30 hover:bg-cream'
      }`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-burgundy" />
      ) : (
        <Heart className={`h-4 w-4 transition-colors ${favId ? 'fill-burgundy text-burgundy' : 'text-muted-foreground'}`} />
      )}
    </button>
  )
}
