'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

const adSlides = ['matrimony', 'business', 'jobs', 'directory'] as const

type AdSlide = (typeof adSlides)[number]

const slideImages: Record<AdSlide, string> = {
  matrimony: '/hero-matrimony.png',
  business: '/hero-business.png',
  jobs: '/hero-jobs.png',
  directory: '/hero-directory.png',
}

const slideColors: Record<AdSlide, string> = {
  matrimony: 'bg-burgundy',
  business: 'bg-gold-dark',
  jobs: 'bg-teal',
  directory: 'bg-burgundy-light',
}

export function HeroAdvertisement() {
  const { t } = useTranslations()
  const [current, setCurrent] = useState(0)
  const total = adSlides.length

  const next = useCallback(() => setCurrent((i) => (i + 1) % total), [total])

  useEffect(() => {
    const timer = setInterval(next, 7000)
    return () => clearInterval(timer)
  }, [next])

  return (
    <section className="relative w-full overflow-hidden">
      {/* Large spacious hero — mobile-first tall */}
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/9] md:aspect-[21/9] lg:aspect-[21/8]">
        <AnimatePresence initial={false} mode="popLayout">
          {adSlides.map((key, idx) => {
            if (idx !== current) return null
            const slide = t.ads[key]

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute inset-0"
              >
                <img
                  src={slideImages[key]}
                  alt={slide.headline}
                  className="absolute inset-0 h-full w-full object-cover"
                />

                {/* Cinematic gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/15" />

                {/* Decorative gold corner accents */}
                <div className="absolute left-4 top-4 hidden h-6 w-6 border-l-2 border-t-2 border-gold/30 rounded-tl-sm md:left-8 md:top-8 md:block md:h-10 md:w-10" />
                <div className="absolute bottom-4 right-4 hidden h-6 w-6 border-r-2 border-b-2 border-gold/30 rounded-br-sm md:bottom-8 md:right-8 md:block md:h-10 md:w-10" />

                {/* Content — positioned for mobile readability */}
                <div className="absolute inset-0 flex items-end sm:items-center">
                  <div className="w-full px-5 pb-8 sm:px-8 sm:pb-0 md:px-14 lg:px-20">
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                      className="max-w-md lg:max-w-lg"
                    >
                      <span
                        className={cn(
                          'inline-block rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-white shadow-sm sm:text-[0.65rem] md:text-xs',
                          slideColors[key]
                        )}
                      >
                        {slide.tag}
                      </span>

                      <h2 className="mt-3 text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-serif">
                        {slide.headline}
                      </h2>

                      <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/80 sm:text-sm md:text-base">
                        {slide.sub}
                      </p>

                      <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-white/30 hover:-translate-y-0.5 active:scale-[0.97] sm:text-sm sm:px-6 sm:py-2.5">
                        {slide.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Minimal pagination dots */}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 sm:bottom-4">
        {adSlides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
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
