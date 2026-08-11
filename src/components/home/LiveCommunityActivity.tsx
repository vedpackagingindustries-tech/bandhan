'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useInView } from 'framer-motion'
import { Users, Heart, Briefcase, Search, Building2, Wifi } from 'lucide-react'
import { useTranslations } from '@/i18n'

type ActivityKey = 'matrimony' | 'business' | 'jobs' | 'directory'

type CountKey = 'profilesViewed' | 'listingsAdded' | 'applicationsSent' | 'organizationsJoined'

type LabelKey = 'matrimonyActivity' | 'businessActivity' | 'jobsActivity' | 'directoryActivity'

interface ActivityConfig {
  key: ActivityKey
  icon: typeof Heart
  color: string
  bgColor: string
  countKey: CountKey
  labelKey: LabelKey
}

const activityConfig: ActivityConfig[] = [
  { key: 'matrimony', icon: Heart, color: 'text-burgundy', bgColor: 'bg-burgundy/8', countKey: 'profilesViewed', labelKey: 'matrimonyActivity' },
  { key: 'business', icon: Briefcase, color: 'text-gold-dark', bgColor: 'bg-gold/10', countKey: 'listingsAdded', labelKey: 'businessActivity' },
  { key: 'jobs', icon: Search, color: 'text-teal', bgColor: 'bg-teal/8', countKey: 'applicationsSent', labelKey: 'jobsActivity' },
  { key: 'directory', icon: Building2, color: 'text-burgundy-light', bgColor: 'bg-burgundy-light/8', countKey: 'organizationsJoined', labelKey: 'directoryActivity' },
]

interface CommunityStats {
  totalMembers: number
  activeUsers: number
  byCategory: { registrationCategory: string; _count: number }[]
}

const EMPTY_STATS: CommunityStats = { totalMembers: 0, activeUsers: 0, byCategory: [] }

const categoryCountMap: Record<string, CountKey> = {
  MATRIMONY: 'profilesViewed',
  BUSINESS: 'listingsAdded',
  JOB: 'applicationsSent',
  DIRECTORY: 'organizationsJoined',
}

export function LiveCommunityActivity() {
  const { t } = useTranslations()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [stats, setStats] = useState<CommunityStats | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [onlineCount, setOnlineCount] = useState(0)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/stats/public')
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setStats(json.data)
        }
      }
    } catch {
      // Silently fall back to empty
    }
  }, [])

  useEffect(() => {
    if (!inView) return
    const timer = setTimeout(fetchStats, 100)
    return () => clearTimeout(timer)
  }, [inView, fetchStats])

  // Compute counts from real stats
  const { counts: computedCounts, onlineCount: computedOnlineCount } = (() => {
    if (!stats) return { counts: {} as Record<string, number>, onlineCount: 0 }
    const newCounts: Record<string, number> = {}
    const byCategory = stats.byCategory || []
    for (const cfg of activityConfig) {
      const found = byCategory.find((c) => c.registrationCategory === cfg.key.toUpperCase())
      newCounts[cfg.countKey] = found ? found._count : 0
    }
    return { counts: newCounts, onlineCount: stats.activeUsers || 0 }
  })()

  const formatNumber = (num: number) =>
    num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num.toString()

  // Show loading state when data hasn't loaded yet and we're in view
  const isLoading = inView && stats === null
  const hasData = stats !== null && (stats.totalMembers > 0 || Object.keys(computedCounts).length > 0)
  const displayCounts = hasData ? computedCounts : counts
  const displayOnline = hasData ? computedOnlineCount : onlineCount

  if (isLoading) {
    return (
      <section ref={ref} className="px-4 py-6 sm:px-6 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center gap-2 md:mb-5">
            <Wifi className="h-3.5 w-3.5 text-burgundy" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
              {t.community.liveActivity}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {activityConfig.map((cfg) => {
              const Icon = cfg.icon
              return (
                <div key={cfg.key} className="flex items-center gap-3 rounded-xl border border-border/40 bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] md:p-4">
                  <div className={`flex h-10 w-10 flex-shrink-0 animate-pulse rounded-xl bg-muted ${cfg.bgColor}`} />
                  <div className="min-w-0">
                    <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                    <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  if (!hasData) {
    return null
  }

  return (
    <section ref={ref} className="px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        {/* Section Label */}
        <div className="mb-4 flex items-center gap-2 md:mb-5">
          <Wifi className="h-3.5 w-3.5 text-burgundy" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
            {t.community.liveActivity}
          </h3>
          {displayOnline > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[0.65rem] font-semibold text-emerald-700">
                {t.community.onlineNow}: {displayOnline}
              </span>
            </span>
          )}
        </div>

        {/* Activity Cards Grid */}
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {activityConfig.map((cfg, idx) => {
            const Icon = cfg.icon
            return (
              <motion.div
                key={cfg.key}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] md:p-4"
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${cfg.bgColor}`}
                >
                  <Icon className={`h-5 w-5 ${cfg.color}`} strokeWidth={1.4} />
                </div>
                <div className="min-w-0">
                  <div className={`text-lg font-bold tracking-tight ${cfg.color} font-serif`}>
                    {formatNumber(displayCounts[cfg.countKey] ?? 0)}
                  </div>
                  <div className="truncate text-[0.65rem] font-medium text-muted-foreground md:text-xs">
                    {t.community[cfg.labelKey]}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
