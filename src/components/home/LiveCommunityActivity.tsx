'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Users, Heart, Briefcase, Search, Building2, Wifi } from 'lucide-react'
import { useTranslations } from '@/i18n'

type ActivityKey = 'matrimony' | 'business' | 'jobs' | 'directory'

const activityConfig: {
  key: ActivityKey
  icon: typeof Heart
  color: string
  bgColor: string
  countKey: string
  labelKey: string
}[] = [
  { key: 'matrimonyActivity', icon: Heart, color: 'text-burgundy', bgColor: 'bg-burgundy/8', countKey: 'profilesViewed', labelKey: 'matrimonyActivity' },
  { key: 'businessActivity', icon: Briefcase, color: 'text-gold-dark', bgColor: 'bg-gold/10', countKey: 'listingsAdded', labelKey: 'businessActivity' },
  { key: 'jobsActivity', icon: Search, color: 'text-teal', bgColor: 'bg-teal/8', countKey: 'applicationsSent', labelKey: 'jobsActivity' },
  { key: 'directoryActivity', icon: Building2, color: 'text-burgundy-light', bgColor: 'bg-burgundy-light/8', countKey: 'organizationsJoined', labelKey: 'directoryActivity' },
]

// Fallback values for development - will be replaced by backend data
const fallbackCounts: Record<ActivityKey, number> = {
  matrimonyActivity: 1247,
  businessActivity: 89,
  jobsActivity: 356,
  directoryActivity: 42,
}

export function LiveCommunityActivity() {
  const { t } = useTranslations()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    if (!inView) return

    const duration = 1800
    const steps = 50
    const interval = duration / steps
    let step = 0

    const timer = setInterval(() => {
      step++
      const progress = step / steps
      const eased = 1 - Math.pow(1 - progress, 3)

      const newCounts: Record<string, number> = {}
      activityConfig.forEach((cfg) => {
        newCounts[cfg.countKey] = Math.floor(fallbackCounts[cfg.key] * eased)
      })
      setCounts(newCounts)
      setOnlineCount(Math.floor(342 * eased))

      if (step >= steps) clearInterval(timer)
    }, interval)

    return () => clearInterval(timer)
  }, [inView])

  // Simulate subtle live fluctuation after initial count
  useEffect(() => {
    if (Object.keys(counts).length === 0) return

    const timer = setInterval(() => {
      setOnlineCount((prev) => prev + Math.floor(Math.random() * 3) - 1)
    }, 5000)

    return () => clearInterval(timer)
  }, [counts])

  const formatNumber = (num: number) =>
    num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num.toString()

  return (
    <section ref={ref} className="px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        {/* Section Label */}
        <div className="mb-4 flex items-center gap-2 md:mb-5">
          <Wifi className="h-3.5 w-3.5 text-burgundy" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
            {t.community.liveActivity}
          </h3>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[0.65rem] font-semibold text-emerald-700">
              {t.community.onlineNow}: {onlineCount}
            </span>
          </span>
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
                    {formatNumber(counts[cfg.countKey] ?? 0)}
                  </div>
                  <div className="truncate text-[0.65rem] font-medium text-muted-foreground md:text-xs">
                    {t.community[cfg.labelKey as keyof typeof t.community]}
                  </div>
                  <div className="text-[0.6rem] text-muted-foreground/70">
                    {t.community[cfg.countKey as keyof typeof t.community]}
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
