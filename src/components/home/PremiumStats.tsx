'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Users, Heart, Briefcase, Building2, Clock } from 'lucide-react'
import { useTranslations } from '@/i18n'

interface StatItem {
  icon: typeof Users
  label: string
  value: number
  suffix: string
  color: string
  bgColor: string
}

export function PremiumStats() {
  const { t } = useTranslations()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [counts, setCounts] = useState<Record<string, number>>({})

  const stats: StatItem[] = [
    { icon: Users, label: t.stats.members, value: 250000, suffix: '+', color: 'text-burgundy', bgColor: 'bg-burgundy/8' },
    { icon: Heart, label: t.stats.marriages, value: 8500, suffix: '+', color: 'text-gold-dark', bgColor: 'bg-gold/10' },
    { icon: Briefcase, label: t.stats.businesses, value: 15000, suffix: '+', color: 'text-teal', bgColor: 'bg-teal/8' },
    { icon: Building2, label: t.stats.organizations, value: 1200, suffix: '+', color: 'text-burgundy-light', bgColor: 'bg-burgundy-light/8' },
    { icon: Clock, label: t.stats.jobs, value: 7500, suffix: '+', color: 'text-rose-gold', bgColor: 'bg-rose-gold/8' },
  ]

  useEffect(() => {
    if (!inView) return

    const duration = 2200
    const steps = 70
    const interval = duration / steps
    let step = 0

    const timer = setInterval(() => {
      step++
      const progress = step / steps
      const eased = 1 - Math.pow(1 - progress, 4)

      const newCounts: Record<string, number> = {}
      stats.forEach((stat, idx) => {
        newCounts[idx] = Math.floor(stat.value * eased)
      })
      setCounts(newCounts)

      if (step >= steps) clearInterval(timer)
    }, interval)

    return () => clearInterval(timer)
  }, [inView])

  const formatNumber = (num: number) => num.toLocaleString('en-IN')

  return (
    <section ref={ref} className="section-padding-sm relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-burgundy/[0.015] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center md:mb-14"
        >
          <span className="inline-block rounded-full bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold-dark">
            {t.stats.sectionTitle}
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-serif">
            {t.stats.sectionSubtitle}
          </h2>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-5"
        >
          {stats.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08, duration: 0.5 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="group text-center rounded-2xl border border-border/40 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.05)]"
              >
                <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${stat.bgColor} transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} strokeWidth={1.4} />
                </div>
                <div className={`text-2xl font-bold tracking-tight sm:text-3xl ${stat.color} font-serif`}>
                  {formatNumber(counts[idx] ?? 0)}
                  <span className="text-lg">{stat.suffix}</span>
                </div>
                <div className="mt-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
                  {stat.label}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}