'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n'

export function FooterAdvertisement() {
  const { t } = useTranslations()
  const ad = t.ads.directory

  return (
    <section className="px-4 py-3 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-30px' }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl"
      >
        {/* Large spacious footer ad */}
        <div className="relative aspect-[21/9] w-full sm:aspect-[21/8] md:aspect-[21/7]">
          <img
            src="/hero-directory.png"
            alt={ad.headline}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />

          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 flex items-center">
            <div className="px-5 sm:px-8 md:px-12">
              <span className="inline-block rounded-full bg-burgundy-light px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-white">
                {ad.tag}
              </span>
              <h3 className="mt-2 text-lg font-bold leading-tight text-white sm:text-xl md:text-2xl font-serif">
                {ad.headline}
              </h3>
              <p className="mt-1 max-w-sm text-[0.65rem] leading-relaxed text-white/75 sm:text-xs">
                {ad.sub}
              </p>
              <button className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-[0.65rem] font-medium text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/30 active:scale-[0.97] sm:text-xs">
                {ad.cta}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
