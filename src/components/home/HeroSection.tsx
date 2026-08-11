'use client'

import { motion } from 'framer-motion'
import { Heart, Briefcase, Search, Building2, ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { SectionDivider } from '@/components/shared/SectionDivider'
import { cn } from '@/lib/utils'

const serviceConfig = [
  {
    key: 'matrimony' as const,
    icon: Heart,
    iconColor: 'text-burgundy',
    borderColor: 'hover:border-burgundy/30',
    bgAccent: 'bg-burgundy/5',
    arrowColor: 'group-hover:text-burgundy',
    ctaBg: 'hover:bg-burgundy hover:text-white hover:border-burgundy',
    ctaBorder: 'border-burgundy/20',
  },
  {
    key: 'business' as const,
    icon: Briefcase,
    iconColor: 'text-gold-dark',
    borderColor: 'hover:border-gold/30',
    bgAccent: 'bg-gold/5',
    arrowColor: 'group-hover:text-gold-dark',
    ctaBg: 'hover:bg-gold-dark hover:text-white hover:border-gold-dark',
    ctaBorder: 'border-gold/20',
  },
  {
    key: 'jobs' as const,
    icon: Search,
    iconColor: 'text-teal',
    borderColor: 'hover:border-teal/30',
    bgAccent: 'bg-teal/5',
    arrowColor: 'group-hover:text-teal',
    ctaBg: 'hover:bg-teal hover:text-white hover:border-teal',
    ctaBorder: 'border-teal/20',
  },
  {
    key: 'directory' as const,
    icon: Building2,
    iconColor: 'text-burgundy-light',
    borderColor: 'hover:border-burgundy-light/30',
    bgAccent: 'bg-burgundy-light/5',
    arrowColor: 'group-hover:text-burgundy-light',
    ctaBg: 'hover:bg-burgundy-light hover:text-white hover:border-burgundy-light',
    ctaBorder: 'border-burgundy-light/20',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
}

export function HeroSection() {
  const { t } = useTranslations()
  const services = t.services

  return (
    <section className="relative overflow-hidden py-12 md:py-20 lg:py-24">
      {/* Subtle background pattern */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold/[0.03] blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-burgundy/[0.03] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading Block */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-10 text-center md:mb-14"
        >
          <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-[2.75rem]">
            {t.hero.title}
          </h1>
          <SectionDivider />
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {t.hero.description}
          </p>
        </motion.div>

        {/* Service Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
        >
          {serviceConfig.map((config) => {
            const Icon = config.icon
            const service = services[config.key]

            return (
              <motion.div
                key={config.key}
                variants={itemVariants}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-300 md:p-6',
                  config.borderColor,
                  'hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]'
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105',
                    config.bgAccent
                  )}
                >
                  <Icon className={cn('h-6 w-6', config.iconColor)} strokeWidth={1.5} />
                </div>

                {/* Content */}
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {service.title}
                </h3>
                <p className="mb-5 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {service.description}
                </p>

                {/* CTA */}
                <button
                  className={cn(
                    'inline-flex w-fit items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97]',
                    config.ctaBorder,
                    config.ctaBg
                  )}
                >
                  {service.cta}
                  <ArrowRight
                    className={cn(
                      'h-3.5 w-3.5 transition-all duration-200',
                      'translate-x-0 group-hover:translate-x-0.5',
                      config.arrowColor
                    )}
                  />
                </button>

                {/* Shimmer overlay on hover */}
                <div className="pointer-events-none absolute inset-0 animate-shimmer opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}