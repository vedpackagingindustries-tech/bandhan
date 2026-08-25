'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Heart, Briefcase, Search, Building2 } from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { SahuSamajFlag } from '@/components/shared/SahuSamajFlag'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'
import { HeaderSearch } from './HeaderSearch'

const navItems = [
  { key: 'home' as const, icon: null },
  { key: 'matrimony' as const, icon: Heart },
  { key: 'business' as const, icon: Briefcase },
  { key: 'jobs' as const, icon: Search },
  { key: 'directory' as const, icon: Building2 },
]

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
        'sticky top-0 z-40 w-full transition-all duration-500',
        scrolled
          ? 'bg-white/90 shadow-[0_1px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl'
          : 'bg-white/70 backdrop-blur-md'
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 md:h-16 lg:px-8">
        {/* Left: Logo + Flag */}
        <div className="flex items-center gap-2 md:gap-3">
          <BandhanLogo />
          <SahuSamajFlag size="sm" className="hidden sm:inline-flex" />
        </div>

        {/* Desktop Nav - no login/register */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navItems.slice(1).map(({ key, icon: Icon }) => (
            <a
              key={key}
              href={`#${key}`}
              className="group relative flex items-center gap-1.5 px-3 py-2 text-[0.8125rem] font-medium tracking-wide text-foreground/70 transition-colors duration-300 hover:text-burgundy"
            >
              {Icon && <Icon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} />}
              {t.nav[key as keyof typeof t.nav]}
              <span className="absolute bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-gradient-to-r from-burgundy to-gold transition-all duration-300 group-hover:w-5" />
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <HeaderSearch />
          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 hover:bg-cream lg:hidden"
            aria-label={t.aria.toggleMenu}
          >
            {mobileOpen ? (
              <X className="h-5 w-5 text-foreground" />
            ) : (
              <Menu className="h-5 w-5 text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 top-[3.75rem] z-40 bg-black/5 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute left-3 right-3 top-full z-50 overflow-hidden rounded-2xl border border-border/30 bg-white/95 shadow-2xl backdrop-blur-2xl lg:hidden"
            >
              <nav className="mx-auto max-w-lg px-2 py-2">
                {navItems.map(({ key, icon: Icon }, idx) => (
                  <motion.a
                    key={key}
                    href={`#${key}`}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground/75 transition-all duration-200 hover:bg-cream hover:text-burgundy"
                  >
                    {Icon && <Icon className="h-4 w-4" strokeWidth={1.5} />}
                    {t.nav[key as keyof typeof t.nav]}
                  </motion.a>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
