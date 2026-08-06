'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

const slideKeys = ['matrimony', 'business', 'jobs', 'directory'] as const
type SlideKey = (typeof slideKeys)[number]

const slideImages: Record<SlideKey, string> = {
  matrimony: '/hero-matrimony.png',
  business: '/hero-business.png',
  jobs: '/hero-jobs.png',
  directory: '/hero-directory.png',
}

const slideColors: Record<SlideKey, { tagBg: string; ctaBg: string; ctaHover: string }> = {
  matrimony: { tagBg: 'bg-burgundy', ctaBg: 'bg-burgundy', ctaHover: 'hover:bg-burgundy-dark hover:shadow-[0_4px_24px_rgba(123,45,59,0.3)]' },
  business: { tagBg: 'bg-gold-dark', ctaBg: 'bg-gold-dark', ctaHover: 'hover:bg-gold hover:shadow-[0_4px_24px_rgba(200,169,81,0.3)]' },
  jobs: { tagBg: 'bg-teal', ctaBg: 'bg-teal', ctaHover: 'hover:bg-teal-light hover:shadow-[0_4px_24px_rgba(44,74,82,0.3)]' },
  directory: { tagBg: 'bg-burgundy-light', ctaBg: 'bg-burgundy-light', ctaHover: 'hover:bg-burgundy hover:shadow-[0_4px_24px_rgba(158,68,85,0.3)]' },
}

export function PremiumHeroCarousel() {
  const { t } = useTranslations()
  const [current, setCurrent] = useState(0)
  const total = slideKeys.length

  const goTo = useCallback(
    (index: number) => setCurrent((index + total) % total),
    [total]
  )
  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  useEffect(() => {
    const timer = setInterval(next, 6000)
    return () => clearInterval(timer)
  }, [next])

  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative aspect-[16/7] w-full md:aspect-[16/6] lg:aspect-[16/5.5]">
        <AnimatePresence initial={false} mode="popLayout">
          {slideKeys.map((key, idx) => {
            if (idx !== current) return null

            const slide = t.heroSlides[key]
            const colors = slideColors[key]

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute inset-0"
              >
                {/* Background Image */}
                <Image
                  src={slideImages[key]}
                  alt={slide.headline}
                  fill
                  sizes="100vw"
                  priority={idx === 0}
                  className="object-cover"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />

                {/* Decorative corner accents */}
                <div className="absolute left-6 top-6 h-8 w-8 border-l-2 border-t-2 border-gold/40 rounded-tl-sm hidden md:block" />
                <div className="absolute bottom-6 right-6 h-8 w-8 border-r-2 border-b-2 border-gold/40 rounded-br-sm hidden md:block" />

                {/* Content */}
                <div className="absolute inset-0 flex items-center">
                  <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 md:px-12 lg:px-16">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
                      className="max-w-lg"
                    >
                      <span
                        className={cn(
                          'inline-block rounded-full px-3.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white shadow-sm',
                          colors.tagBg
                        )}
                      >
                        {slide.tag}
                      </span>

                      <h2 className="mt-4 text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl lg:text-5xl font-serif">
                        {slide.headline}
                      </h2>

                      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80 sm:text-base md:text-lg">
                        {slide.sub}
                      </p>

                      <button
                        className={cn(
                          'mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.97]',
                          colors.ctaBg,
                          colors.ctaHover
                        )}
                      >
                        {slide.cta}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-white/30 hover:scale-105 opacity-0 group-hover:opacity-100 sm:opacity-60 hover:!opacity-100"
        aria-label="Previous"
      >
        <ChevronLeft className="h-5 w-5 text-white" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-white/30 hover:scale-105 opacity-0 group-hover:opacity-100 sm:opacity-60 hover:!opacity-100"
        aria-label="Next"
      >
        <ChevronRight className="h-5 w-5 text-white" />
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {slideKeys.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              idx === current
                ? 'w-8 bg-gold shadow-[0_0_8px_rgba(200,169,81,0.5)]'
                : 'w-1.5 bg-white/40 hover:bg-white/60'
            )}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  )
}