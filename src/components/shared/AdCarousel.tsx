'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Heart, Briefcase, Search, Building2, ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

const slideKeys = ['matrimony', 'business', 'jobs', 'directory'] as const

type SlideKey = (typeof slideKeys)[number]

const slideVisuals: Record<SlideKey, { icon: typeof Heart; gradient: string; iconBg: string; iconColor: string; tagBg: string; tagColor: string; ctaHover: string }> = {
  matrimony: {
    icon: Heart,
    gradient: 'from-burgundy/[0.06] via-white to-gold/[0.04]',
    iconBg: 'bg-burgundy/10',
    iconColor: 'text-burgundy',
    tagBg: 'bg-burgundy',
    tagColor: 'text-white',
    ctaHover: 'hover:bg-burgundy hover:text-white hover:border-burgundy',
  },
  business: {
    icon: Briefcase,
    gradient: 'from-gold/[0.07] via-white to-cream',
    iconBg: 'bg-gold/15',
    iconColor: 'text-gold-dark',
    tagBg: 'bg-gold-dark',
    tagColor: 'text-white',
    ctaHover: 'hover:bg-gold-dark hover:text-white hover:border-gold-dark',
  },
  jobs: {
    icon: Search,
    gradient: 'from-teal/[0.06] via-white to-ivory',
    iconBg: 'bg-teal/10',
    iconColor: 'text-teal',
    tagBg: 'bg-teal',
    tagColor: 'text-white',
    ctaHover: 'hover:bg-teal hover:text-white hover:border-teal',
  },
  directory: {
    icon: Building2,
    gradient: 'from-burgundy-light/[0.05] via-white to-gold-light/[0.04]',
    iconBg: 'bg-burgundy-light/10',
    iconColor: 'text-burgundy-light',
    tagBg: 'bg-burgundy-light',
    tagColor: 'text-white',
    ctaHover: 'hover:bg-burgundy-light hover:text-white hover:border-burgundy-light',
  },
}

export function AdCarousel({ className }: { className?: string }) {
  const { t } = useTranslations()
  const ads = t.ads
  const [current, setCurrent] = useState(0)
  const total = slideKeys.length

  const goTo = useCallback(
    (index: number) => setCurrent((index + total) % total),
    [total]
  )
  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  useEffect(() => {
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [next])

  return (
    <div
      className={cn('group relative w-full overflow-hidden rounded-2xl', className)}
    >
      {/* ── Slides ── */}
      <div className="relative h-44 w-full sm:h-48 md:h-52 lg:h-56">
        <AnimatePresence initial={false} mode="popLayout">
          {slideKeys.map((key, idx) => {
            if (idx !== current) return null

            const visual = slideVisuals[key]
            const ad = ads[key]
            const Icon = visual.icon

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={cn(
                  'absolute inset-0 flex items-center bg-gradient-to-br',
                  visual.gradient
                )}
              >
                {/* Decorative elements */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-gold/[0.08] to-transparent blur-2xl" />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-gradient-to-tr from-burgundy/[0.06] to-transparent blur-2xl" />

                {/* Corner accents */}
                <div className="absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-gold/25 rounded-tl-sm" />
                <div className="absolute bottom-4 right-4 h-5 w-5 border-r-2 border-b-2 border-gold/25 rounded-br-sm" />

                {/* Content */}
                <div className="relative z-10 flex w-full items-center gap-5 px-6 sm:px-8 md:px-10 lg:gap-8 lg:px-14">
                  {/* Icon */}
                  <div
                    className={cn(
                      'hidden flex-shrink-0 items-center justify-center rounded-2xl sm:flex h-16 w-16 md:h-20 md:w-20',
                      visual.iconBg
                    )}
                  >
                    <Icon
                      className={cn('h-8 w-8 md:h-10 md:w-10', visual.iconColor)}
                      strokeWidth={1.4}
                    />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        'inline-block rounded-full px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest sm:mb-1.5',
                        visual.tagBg,
                        visual.tagColor
                      )}
                    >
                      {ad.tag}
                    </span>
                    <h3 className="mt-1 text-base font-bold leading-snug text-foreground sm:text-lg md:text-xl lg:text-2xl">
                      {ad.headline}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm max-w-xl">
                      {ad.sub}
                    </p>
                  </div>

                  {/* CTA */}
                  <button
                    className={cn(
                      'hidden flex-shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-white/80 px-4 py-2 text-xs font-medium shadow-sm backdrop-blur-sm transition-all duration-200 md:flex lg:text-sm active:scale-[0.97]',
                      visual.ctaHover
                    )}
                  >
                    {ad.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* ── Navigation Arrows ── */}
      <button
        onClick={prev}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-md opacity-0 group-hover:opacity-100 sm:h-9 sm:w-9"
        aria-label={t.aria.previous}
      >
        <ChevronLeft className="h-4 w-4 text-burgundy" />
      </button>
      <button
        onClick={next}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-md opacity-0 group-hover:opacity-100 sm:h-9 sm:w-9"
        aria-label={t.aria.next}
      >
        <ChevronRight className="h-4 w-4 text-burgundy" />
      </button>

      {/* ── Dots ── */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
        {slideKeys.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              idx === current
                ? 'w-6 bg-gold'
                : 'w-1.5 bg-gold/30 hover:bg-gold/50'
            )}
            aria-label={`${t.aria.goToSlide} ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  )
}