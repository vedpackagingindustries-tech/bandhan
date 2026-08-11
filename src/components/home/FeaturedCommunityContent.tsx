'use client'

import { motion } from 'framer-motion'
import { MataKarmaVisual } from '@/components/shared/MataKarmaVisual'
import { SahuSamajFlag } from '@/components/shared/SahuSamajFlag'
import { useTranslations } from '@/i18n'

export function FeaturedCommunityContent() {
  const { t } = useTranslations()

  return (
    <section className="relative overflow-hidden px-4 py-10 sm:px-6 md:py-16">
      {/* Subtle warm glow background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.04] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-6 text-center md:gap-8"
        >
          <div className="flex items-center gap-3">
            <SahuSamajFlag size="md" />
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl font-serif">
                {t.topBar.organization}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t.topBar.address}
              </p>
            </div>
          </div>

          <MataKarmaVisual size="lg" showAura />

          <div className="max-w-md">
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t.footer.aboutText}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
