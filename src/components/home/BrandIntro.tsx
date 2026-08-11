'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { SahuSamajFlag } from '@/components/shared/SahuSamajFlag'
import { MataKarmaVisual } from '@/components/shared/MataKarmaVisual'

const INTRO_KEY = 'bandhan-intro-seen'
const MUTE_KEY = 'bandhan-intro-muted'
const STEP_DURATION = 2800

export function BrandIntro() {
  const { t } = useTranslations()
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(INTRO_KEY) === null
  })
  const [step, setStep] = useState(0)
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(MUTE_KEY) === 'true'
  })
  const [skipping, setSkipping] = useState(false)

  const totalSteps = 5

  const finishIntro = useCallback(() => {
    localStorage.setItem(INTRO_KEY, 'true')
    document.body.style.overflow = ''
    setShow(false)
  }, [])

  const skipIntro = useCallback(() => {
    setSkipping(true)
    finishIntro()
  }, [finishIntro])

  // Handle body overflow based on show state
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [show])

  // Auto-advance steps
  useEffect(() => {
    if (!show || skipping) return
    if (step >= totalSteps) {
      const timer = setTimeout(finishIntro, 100)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_DURATION)
    return () => clearTimeout(timer)
  }, [show, step, skipping, finishIntro])

  const replayIntro = useCallback(() => {
    localStorage.removeItem(INTRO_KEY)
    setStep(0)
    setSkipping(false)
    setShow(true)
    document.body.style.overflow = 'hidden'
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localStorage.setItem(MUTE_KEY, String(next))
      return next
    })
  }, [])

  const steps = [
    // Step 0: Bharat/Chhattisgarh highlight
    {
      content: (
        <div className="flex flex-col items-center gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-burgundy/10 to-gold/10 md:h-36 md:w-36">
              <span className="text-5xl md:text-6xl">️</span>
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-burgundy px-3 py-0.5 text-[0.55rem] font-semibold text-white">
              {t.topBar.organization}
            </div>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-center text-sm text-foreground/70 sm:text-base"
          >
            {t.topBar.address}
          </motion.p>
        </div>
      ),
    },
    // Step 1: Sahu Samaj Flag
    {
      content: (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center gap-4"
        >
          <SahuSamajFlag size="lg" />
          <p className="text-sm font-medium text-foreground/80">{t.topBar.organization}</p>
        </motion.div>
      ),
    },
    // Step 2: Mata Karma
    {
      content: (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center gap-4"
        >
          <MataKarmaVisual size="lg" showAura />
          <p className="text-center text-sm font-medium text-gold-dark">{t.topBar.organization}</p>
        </motion.div>
      ),
    },
    // Step 3: Bandhan Logo
    {
      content: (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="scale-150 sm:scale-[1.8]">
              <BandhanLogo />
            </div>
            <p className="text-xs text-muted-foreground">SAHU SAMAJ CONNECTS</p>
          </div>
        </motion.div>
      ),
    },
    // Step 4: Welcome to Bandhan
    {
      content: (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl font-serif">
            Bandhan
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t.hero.description.substring(0, 120)}...
          </p>
          <div className="mt-2 flex gap-2">
            <span className="text-2xl">❤️</span>
            <span className="text-2xl">💼</span>
            <span className="text-2xl">💼</span>
            <span className="text-2xl">🏛️</span>
          </div>
        </motion.div>
      ),
    },
  ]

  const dotClassName = (idx: number) => {
    if (idx === step) return 'h-1.5 w-8 bg-burgundy'
    if (idx < step) return 'h-1.5 w-2 bg-burgundy/40'
    return 'h-1.5 w-1.5 bg-border'
  }

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ivory"
          >
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-foreground/60 shadow-sm backdrop-blur-sm transition-all hover:text-burgundy"
                aria-label={muted ? t.intro.unmuted : t.intro.muted}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                onClick={skipIntro}
                className="flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground/70 shadow-sm backdrop-blur-sm transition-all hover:text-burgundy"
              >
                {t.intro.skip}
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(dotClassName(idx), 'rounded-full transition-all duration-500')}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {steps[step] && (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.5 }}
                >
                  {steps[step].content}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {!show && (
        <button
          onClick={replayIntro}
          className="fixed bottom-20 right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-muted-foreground/50 shadow-md backdrop-blur-sm transition-all duration-300 hover:text-burgundy hover:shadow-lg"
          aria-label={t.intro.replay}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
