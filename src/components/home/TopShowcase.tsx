'use client'

// ═══════════════════════════════════════════════════════════════
// MONTHLY TOP 10 PREMIUM SHOWCASE (homepage hero section)
// Shows real, approved premium listings for the 2-day monthly window.
// Auto-expires server-side. CONNECT button instead of any phone number.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Crown, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'

interface ShowcaseItem {
  id: string
  module: string
  listingId: string
  title: string | null
  subtitle: string | null
  imageUrl: string | null
  rank: number
  endsAt: string
}

interface ShowcaseData {
  active: boolean
  monthKey: string
  windowEndsAt: string | null
  items: ShowcaseItem[]
}

const MODULE_META: Record<string, { label: string; hi: string; chip: string; border: string; hash: string }> = {
  MATRIMONY: { label: 'Matrimony', hi: 'मैट्रिमोनी', chip: 'bg-burgundy', border: 'border-burgundy/20', hash: 'matrimony' },
  BUSINESS: { label: 'Business', hi: 'बिज़नेस', chip: 'bg-gold-dark', border: 'border-gold-dark/20', hash: 'business' },
  JOBS: { label: 'Jobs', hi: 'जॉब्स', chip: 'bg-teal', border: 'border-teal/20', hash: 'jobs' },
}

export function TopShowcase() {
  const [data, setData] = useState<ShowcaseData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<ShowcaseData>('/showcase').then((res) => {
      if (res.ok) setData(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-muted" />)}
          </div>
        </div>
      </section>
    )
  }

  // Only render when the showcase window is ACTIVE (2-day window)
  if (!data?.active || !data.items.length) return null

  const modules = ['MATRIMONY', 'BUSINESS', 'JOBS'] as const

  return (
    <section className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-burgundy to-burgundy-light px-3.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-white">
            <Crown className="h-3 w-3" /> Monthly Top 10 Showcase
          </span>
          <h2 className="mt-2 font-serif text-xl font-bold text-foreground sm:text-2xl">इस माह के टॉप प्रीमियम सदस्य</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            हर माह की शुरुआत में चुनी गई शीर्ष प्रीमियम लिस्टिंग — केवल 2 दिनों के लिए
            {data.windowEndsAt && <> · समाप्त: {new Date(data.windowEndsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} IST</>}
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {modules.map((mod) => {
            const items = data.items.filter((i) => i.module === mod).slice(0, 10)
            if (!items.length) return null
            const meta = MODULE_META[mod]
            return (
              <div key={mod} className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${meta.border}`}>
                <div className="flex items-center gap-2">
                  <span className={`rounded-lg ${meta.chip} px-2.5 py-1 text-[0.65rem] font-bold text-white`}>
                    Top {items.length} · {meta.hi}
                  </span>
                </div>
                <ol className="mt-3 space-y-2">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2.5 rounded-xl border border-border/30 p-2 transition-colors hover:bg-cream/60">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold-dark">
                        {item.rank}
                      </span>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${meta.chip}/10 text-xs font-bold ${meta.chip.replace('bg-', 'text-')}`}>
                          {meta.hi.charAt(0)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">{item.title}</p>
                        <p className="truncate text-[0.65rem] text-muted-foreground">{item.subtitle ?? meta.label}</p>
                      </div>
                      {/* CONNECT — never a phone number */}
                      <a
                        href={`#${meta.hash}`}
                        className="flex-shrink-0 rounded-lg bg-burgundy px-2.5 py-1 text-[0.6rem] font-bold text-white hover:bg-burgundy-light"
                      >
                        CONNECT
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-center text-[0.65rem] text-muted-foreground">
          रैंकिंग प्रीमियम स्थिति, प्रोफ़ाइल गुणवत्ता और लोकप्रियता पर आधारित है — केवल वास्तविक, स्वीकृत प्रीमियम लिस्टिंग।
        </p>
      </div>
    </section>
  )
}
