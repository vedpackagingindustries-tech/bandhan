'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Heart, Quote } from 'lucide-react'
import { useTranslations } from '@/i18n'

const stories = ['couple1', 'couple2'] as const

const storyImages: Record<string, string> = {
  couple1: '/success-story-1.png',
  couple2: '/success-story-2.png',
}

export function SuccessStories() {
  const { t } = useTranslations()

  return (
    <section className="section-padding relative overflow-hidden bg-cream/50">
      {/* Subtle decorative elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-burgundy/[0.02] blur-3xl" />
        <div className="absolute left-0 bottom-0 h-72 w-72 rounded-full bg-gold/[0.03] blur-3xl" />
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
          <span className="inline-block rounded-full bg-burgundy/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-burgundy">
            {t.successStories.sectionTitle}
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl font-serif">
            {t.successStories.sectionSubtitle}
          </h2>
        </motion.div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {stories.map((key, idx) => {
            const story = t.successStories[key]
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: idx * 0.15, duration: 0.6 }}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-3xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all duration-500 hover:shadow-[0_16px_48px_rgba(0,0,0,0.06)]"
              >
                {/* Image */}
                <div className="relative h-56 overflow-hidden sm:h-64">
                  <Image
                    src={storyImages[key]}
                    alt={story.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                  {/* Couple Name Overlay */}
                  <div className="absolute bottom-4 left-5">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-gold" fill="currentColor" />
                      <h3 className="text-lg font-bold text-white font-serif">{story.name}</h3>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-white/80">
                      {story.location}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="relative p-6 sm:p-8">
                  <Quote className="absolute -top-3 left-6 h-8 w-8 text-gold/20" />
                  <p className="relative text-sm leading-relaxed text-muted-foreground">
                    {story.story}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-burgundy font-medium">
                    <Heart className="h-3.5 w-3.5" />
                    {story.date}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}