'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, User, LogIn } from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

const navItems = ['matrimony', 'business', 'jobs', 'directory'] as const

export function Header() {
  const { t } = useTranslations()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-white/95 shadow-[0_1px_20px_rgba(0,0,0,0.04)] backdrop-blur-lg'
          : 'bg-white/60 backdrop-blur-sm'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex-shrink-0">
          <BandhanLogo />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((key) => (
            <a
              key={key}
              href={`#${key}`}
              className="relative px-3.5 py-2 text-[0.8125rem] font-medium tracking-wide text-foreground/80 transition-colors duration-200 hover:text-burgundy after:absolute after:bottom-0.5 after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-burgundy after:transition-all after:duration-300 hover:after:w-5"
            >
              {t.nav[key as keyof typeof t.nav]}
            </a>
          ))}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher />

          {/* Desktop Auth Buttons */}
          <div className="hidden items-center gap-2 lg:flex">
            <button className="flex items-center gap-1.5 rounded-full border border-burgundy/20 px-4 py-1.5 text-xs font-medium text-burgundy transition-all duration-200 hover:bg-burgundy hover:text-white hover:shadow-[0_2px_12px_rgba(123,45,59,0.2)]">
              <LogIn className="h-3.5 w-3.5" />
              {t.nav.login}
            </button>
            <button className="flex items-center gap-1.5 rounded-full bg-burgundy px-4 py-1.5 text-xs font-medium text-white shadow-[0_2px_12px_rgba(123,45,59,0.15)] transition-all duration-200 hover:bg-burgundy-dark hover:shadow-[0_4px_16px_rgba(123,45,59,0.25)]">
              <User className="h-3.5 w-3.5" />
              {t.nav.register}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-cream lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5 text-foreground" />
            ) : (
              <Menu className="h-5 w-5 text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-16 z-40 bg-black/10 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Mobile Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute left-0 right-0 top-16 z-50 border-b border-border/50 bg-white/98 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:hidden"
            >
              <nav className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
                {navItems.map((key, idx) => (
                  <motion.a
                    key={key}
                    href={`#${key}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.25 }}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center rounded-xl px-4 py-3 text-sm font-medium text-foreground/80 transition-all duration-200 hover:bg-cream hover:text-burgundy"
                  >
                    {t.nav[key as keyof typeof t.nav]}
                  </motion.a>
                ))}
                <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3">
                  <button className="flex items-center justify-center gap-2 rounded-xl border border-burgundy/20 px-4 py-2.5 text-sm font-medium text-burgundy transition-all hover:bg-burgundy hover:text-white">
                    <LogIn className="h-4 w-4" />
                    {t.nav.login}
                  </button>
                  <button className="flex items-center justify-center gap-2 rounded-xl bg-burgundy px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-burgundy-dark">
                    <User className="h-4 w-4" />
                    {t.nav.register}
                  </button>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
