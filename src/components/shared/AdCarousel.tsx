'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdSlide {
  id: number
  bgColor: string
  accent: string
  title: string
  subtitle: string
}

const defaultSlides: AdSlide[] = [
  {
    id: 1,
    bgColor: 'from-burgundy/5 via-cream to-gold/5',
    accent: 'bg-burgundy',
    title: '',
    subtitle: '',
  },
  {
    id: 2,
    bgColor: 'from-gold/5 via-ivory to-teal/5',
    accent: 'bg-gold',
    title: '',
    subtitle: '',
  },
  {
    id: 3,
    bgColor: 'from-teal/5 via-cream to-burgundy/5',
    accent: 'bg-teal',
    title: '',
    subtitle: '',
  },
]

export function AdCarousel({ className }: { className?: string }) {
  const [current, setCurrent] = useState(0)
  const slides = defaultSlides
  const total = slides.length

  const goTo = useCallback(
    (index: number) => {
      setCurrent((index + total) % total)
    },
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
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl',
        className
      )}
    >
      {/* Slides */}
      <div className="relative h-36 w-full md:h-48 lg:h-56">
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={cn(
              'absolute inset-0 bg-gradient-to-br transition-all duration-700 ease-in-out',
              slide.bgColor,
              idx === current
                ? 'translate-x-0 opacity-100'
                : idx < current
                  ? '-translate-x-full opacity-0'
                  : 'translate-x-full opacity-0'
            )}
          >
            {/* Premium ad placeholder with elegant pattern */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground/40">
                <div className="flex items-center gap-2">
                  <div className="h-px w-8 bg-gradient-to-r from-transparent to-gold/30" />
                  <span className="text-xs font-medium tracking-[0.2em] uppercase">
                    Advertisement
                  </span>
                  <div className="h-px w-8 bg-gradient-to-l from-transparent to-gold/30" />
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-0.5 w-0.5 rounded-full bg-gold/40"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Corner accents */}
            <div className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-gold/20 rounded-tl-sm" />
            <div className="absolute bottom-4 right-4 h-6 w-6 border-r-2 border-b-2 border-gold/20 rounded-br-sm" />
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-md opacity-0 group-hover:opacity-100"
        aria-label="Previous"
      >
        <ChevronLeft className="h-4 w-4 text-burgundy" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-md opacity-0 group-hover:opacity-100"
        aria-label="Next"
      >
        <ChevronRight className="h-4 w-4 text-burgundy" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              idx === current
                ? 'w-6 bg-gold'
                : 'w-1.5 bg-gold/30 hover:bg-gold/50'
            )}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
