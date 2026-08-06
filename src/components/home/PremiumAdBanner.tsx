'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

interface BannerSlide {
  key: string
  image: string
  tagBg: string
  ctaBg: string
  ctaHover: string
  tagGradient?: string
}

const bannerSlides: BannerSlide[] = [
  { key: 'matrimony', image: '/hero-matrimony.png', tagBg: 'bg-burgundy', ctaBg: 'bg-white text-burgundy', ctaHover: 'hover:bg-burgundy hover:text-white' },
  { key: 'business', image: '/hero-business.png', tagBg: 'bg-gold-dark', ctaBg: 'bg-white text-gold-dark', ctaHover: 'hover:bg-gold-dark hover:text-white' },
  { key: 'jobs', image: '/hero-jobs.png', tagBg: 'bg-teal', ctaBg: 'bg-white text-teal', ctaHover: 'hover:bg-teal hover:text-white' },
  { key: 'directory', image: '/hero-directory.png', tagBg: 'bg-burgundy-light', ctaBg: 'bg-white text-burgundy-light', ctaHover: 'hover:bg-burgundy-light hover:text-white' },
]

export function PremiumAdBanner({ slideIndex = 0 }: { slideIndex?: number }) {
  const { t } = useTranslations()
  const slide = bannerSlides[slideIndex % bannerSlides.length]
  const ad = t.ads[slide.key as keyof typeof t.ads]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.005 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl',
        'h-48 sm:h-56 md:h-64'
      )}
    >
      {/* Background Image */}
      <Image
        src={slide.image}
        alt={ad.headline}
        fill
        sizes="(max-width: 1280px) 100vw, 1280px"
        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center">
        <div className="px-6 sm:px-10 md:px-14">
          <span className={cn('inline-block rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-white', slide.tagBg)}>
            {ad.tag}
          </span>
          <h3 className="mt-3 text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl font-serif">
            {ad.headline}
          </h3>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-white/75 sm:text-sm">
            {ad.sub}
          </p>
          <button className={cn('mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-medium shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.97]', slide.ctaBg, slide.ctaHover)}>
            {ad.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-gold/30 rounded-tl-sm hidden md:block" />
      <div className="absolute right-4 bottom-4 h-6 w-6 border-r-2 border-b-2 border-gold/30 rounded-br-sm hidden md:block" />
    </motion.div>
  )
}
