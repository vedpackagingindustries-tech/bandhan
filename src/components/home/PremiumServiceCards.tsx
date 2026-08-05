'use client'

import { motion } from 'framer-motion'
import { Heart, Briefcase, Search, Building2, ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

const serviceConfig = [
  {
    key: 'matrimony' as const,
    icon: Heart,
    iconBg: 'bg-burgundy/8',
    iconColor: 'text-burgundy',
    borderHover: 'hover:border-burgundy/20',
    ctaBorder: 'border-burgundy/15',
    ctaHover: 'hover:bg-burgundy hover:text-white hover:border-burgundy hover:shadow-[0_4px_20px_rgba(123,45,59,0.2)]',
    arrowHover: 'group-hover:text-white group-hover:translate-x-1',
  },
  {
    key: 'business' as const,
    icon: Briefcase,
    iconBg: 'bg-gold/10',
    iconColor: 'text-gold-dark',
    borderHover: 'hover:border-gold/20',
    ctaBorder: 'border-gold/15',
    ctaHover: 'hover:bg-gold-dark hover:text-white hover:border-gold-dark hover:shadow-[0_4px_20px_rgba(200,169,81,0.2)]',
    arrowHover: 'group-hover:text-white group-hover:translate-x-1',
  },
  {
    key: 'jobs' as const,
    icon: Search,
    iconBg: 'bg-teal/8',
    iconColor: 'text-teal',
    borderHover: 'hover:border-teal/20',
    ctaBorder: 'border-teal/15',
    ctaHover: 'hover:bg-teal hover:text-white hover:border-teal hover:shadow-[0_4px_20px_rgba(44,74,82,0.2)]',
    arrowHover: 'group-hover:text-white group-hover:translate-x-1',
  },
  {
    key: 'directory' as const,
    icon: Building2,
    iconBg: 'bg-burgundy-light/8',
    iconColor: 'text-burgundy-light',
    borderHover: 'hover:border-burgundy-light/20',
    ctaBorder: 'border-burgundy-light/15',
    ctaHover: 'hover:bg-burgundy-light hover:text-white hover:border-burgundy-light hover:shadow-[0_4px_20px_rgba(158,68,85,0.2)]',
    arrowHover: 'group-hover:text-white group-hover:translate-x-1',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export function PremiumServiceCards() {
  const { t } = useTranslations()
  const services = t.services

  return (
    <section className="section-padding relative overflow-hidden">
      {/* Subtle background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-gold/[0.03] blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-burgundy/[0.02] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center md:mb-16"
        >
          <span className="inline-block rounded-full bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold-dark">
            {t.services.sectionTitle}
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl font-serif">
            {t.services.sectionSubtitle}
          </h2>
        </motion.div>

        {/* Service Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
        >
          {serviceConfig.map((config) => {
            const Icon = config.icon
            const service = services[config.key]

            return (
              <motion.div
                key={config.key}
                variants={itemVariants}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-500 md:p-7',
                  config.borderHover,
                  'hover:-translate-y-1.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)]'
                )}
              >
                {/* Glass shimmer on hover */}
                <div className="pointer-events-none absolute inset-0 animate-shimmer opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                {/* Icon */}
                <div
                  className={cn(
                    'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110',
                    config.iconBg
                  )}
                >
                  <Icon className={cn('h-7 w-7', config.iconColor)} strokeWidth={1.4} />
                </div>

                {/* Content */}
                <h3 className="mb-2.5 text-lg font-semibold text-foreground">
                  {service.title}
                </h3>
                <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {service.description}
                </p>

                {/* CTA */}
                <button
                  className={cn(
                    'inline-flex w-fit items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-300 active:scale-[0.97]',
                    config.ctaBorder,
                    config.ctaHover
                  )}
                >
                  {service.cta}
                  <ArrowRight className={cn('h-3.5 w-3.5 transition-all duration-300', config.arrowHover)} />
                </button>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}