'use client'

import { motion } from 'framer-motion'
import { Heart, Briefcase, Search, Building2, ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

const moduleConfig = [
  {
    key: 'matrimony' as const,
    icon: Heart,
    emoji: '❤\uFE0F',
    image: '/hero-matrimony.png',
    gradient: 'from-burgundy/80 via-burgundy-dark/60 to-burgundy/80',
    iconBg: 'bg-white/15',
    labelKey: 'matrimony' as const,
  },
  {
    key: 'business' as const,
    icon: Briefcase,
    emoji: '\uD83D\uDCBC',
    image: '/hero-business.png',
    gradient: 'from-gold-dark/80 via-gold/60 to-gold-dark/80',
    iconBg: 'bg-white/15',
    labelKey: 'business' as const,
  },
  {
    key: 'jobs' as const,
    icon: Search,
    emoji: '\uD83D\uDCBC',
    image: '/hero-jobs.png',
    gradient: 'from-teal/80 via-teal-light/60 to-teal/80',
    iconBg: 'bg-white/15',
    labelKey: 'jobs' as const,
  },
  {
    key: 'directory' as const,
    icon: Building2,
    emoji: '\uD83C\uDFDB\uFE0F',
    image: '/hero-directory.png',
    gradient: 'from-burgundy-light/80 via-burgundy/60 to-burgundy-light/80',
    iconBg: 'bg-white/15',
    labelKey: 'directory' as const,
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
}

export function ModuleGrid() {
  const { t } = useTranslations()

  return (
    <section className="px-4 py-4 sm:px-6 md:py-6">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        className="mx-auto grid max-w-7xl grid-cols-2 gap-3 md:gap-4 lg:gap-5"
      >
        {moduleConfig.map((mod) => {
          const Icon = mod.icon
          const moduleT = t.modules[mod.labelKey]
          const navTitle = t.nav[mod.key]

          return (
            <motion.a
              key={mod.key}
              href={`#${mod.key}`}
              variants={itemVariants}
              className={cn(
                'group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl',
                'aspect-[4/3] sm:aspect-[16/10] md:aspect-[16/9]',
                'transition-all duration-300 active:scale-[0.97]',
                'shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
                'hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:-translate-y-0.5'
              )}
            >
              {/* Background Image */}
              <img
                src={mod.image}
                alt={navTitle}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />

              {/* Gradient Overlay */}
              <div className={cn('absolute inset-0 bg-gradient-to-t', mod.gradient)} />

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center gap-2 px-3 py-4 text-center sm:gap-3 sm:py-6">
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl sm:h-14 sm:w-14 md:h-16 md:w-16',
                    'border border-white/20 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110',
                    mod.iconBg
                  )}
                >
                  <Icon className="h-6 w-6 text-white sm:h-7 sm:w-7 md:h-8 md:w-8" strokeWidth={1.3} />
                </div>

                <h3 className="text-base font-bold text-white sm:text-lg md:text-xl font-serif">
                  {navTitle}
                </h3>

                <p className="hidden text-[0.65rem] leading-relaxed text-white/80 sm:block sm:text-xs md:text-sm">
                  {moduleT.shortBenefit}
                </p>

                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[0.6rem] font-medium text-white backdrop-blur-sm transition-all duration-300 group-hover:bg-white/25 sm:text-xs">
                  {moduleT.explore}
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </div>
            </motion.a>
          )
        })}
      </motion.div>
    </section>
  )
}
