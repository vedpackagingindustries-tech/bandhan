'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useInView } from 'framer-motion'
import { Users, Briefcase, Heart, Building2 } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { SectionDivider } from '@/components/shared/SectionDivider'

interface StatItem {
  icon: typeof Users
  label: string
  value: number
  suffix: string
  color: string
}

interface DashboardData {
  analytics: {
    totalUsers: number
    activeUsers: number
    pendingApprovals: number
    premiumMembers: number
    eliteMembers: number
  }
}

export function StatsSection() {
  const { t } = useTranslations()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/stats/public')
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          return json.data
        }
      }
    } catch {
      // Silently fall back
    }
    return null
  }, [])

  useEffect(() => {
    if (!inView) return

    let stats: StatItem[]

    const load = async () => {
      const data = await fetchStats()

      if (data && data.totalMembers) {
        stats = [
          { icon: Users, label: t.stats.members, value: data.totalMembers, suffix: '+', color: 'text-burgundy' },
          { icon: Briefcase, label: t.stats.businesses, value: data.totalBusinesses || 0, suffix: '+', color: 'text-gold-dark' },
          { icon: Heart, label: t.stats.matches, value: data.successfulMarriages || 0, suffix: '+', color: 'text-teal' },
          { icon: Building2, label: t.stats.organizations, value: data.totalOrganizations || 0, suffix: '+', color: 'text-burgundy-light' },
        ]
      } else {
        // No real data available — don't show fake numbers
        setLoaded(true)
        return
      }

      const duration = 2000
      const steps = 60
      const interval = duration / steps
      let step = 0

      const timer = setInterval(() => {
        step++
        const progress = step / steps
        const eased = 1 - Math.pow(1 - progress, 3)

        const newCounts: Record<string, number> = {}
        stats.forEach((stat, idx) => {
          newCounts[idx] = Math.floor(stat.value * eased)
        })
        setCounts(newCounts)

        if (step >= steps) clearInterval(timer)
      }, interval)

      setLoaded(true)
    }

    load()
  }, [inView, t.stats, fetchStats])

  // Fallback stats when real data is available
  const stats: StatItem[] = [
    { icon: Users, label: t.stats.members, value: counts[0] ?? 0, suffix: '+', color: 'text-burgundy' },
    { icon: Briefcase, label: t.stats.businesses, value: counts[1] ?? 0, suffix: '+', color: 'text-gold-dark' },
    { icon: Heart, label: t.stats.matches, value: counts[2] ?? 0, suffix: '+', color: 'text-teal' },
    { icon: Building2, label: t.stats.organizations, value: counts[3] ?? 0, suffix: '+', color: 'text-burgundy-light' },
  ]

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-IN')
  }

  if (loaded && Object.keys(counts).length === 0) {
    return null
  }

  return (
    <section ref={ref} className="relative py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionDivider />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8"
        >
          {stats.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <div key={idx} className="group text-center">
                <div className="mb-2.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cream transition-transform duration-300 group-hover:scale-110">
                  <Icon className={`h-5 w-5 ${stat.color}`} strokeWidth={1.5} />
                </div>
                <div className={`text-2xl font-bold tracking-tight sm:text-3xl ${stat.color}`} />
                <div className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
                  {stat.label}
                </div>
              </div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
