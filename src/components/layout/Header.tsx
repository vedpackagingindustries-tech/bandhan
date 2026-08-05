'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, User, LogIn, Heart, Briefcase, Search, Building2, CalendarDays, Phone } from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

const navItems = [
  { key: 'home' as const, icon: null },
  { key: 'matrimony' as const, icon: Heart },
  { key: 'business' as const, icon: Briefcase },
  { key: 'jobs' as const, icon: Search },
  { key: 'directory' as const, icon: Building2 },
  { key: 'events' as const, icon: CalendarDays },
  { key: 'contact' as const, icon: Phone },
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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex-shrink-0">
          <BandhanLogo />
        </div>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-0.5 xl:flex">
          {navItems.slice(1).map(({ key, icon: Icon }) => (
            <a
              key={key}
              href={`#${key}`}
              className="group relative flex items-center gap-1.5 px-3.5 py-2 text-[0.8125rem] font-medium tracking-wide text-foreground/70 transition-colors duration-300 hover:text-burgundy"
            >
              {Icon && <Icon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} />}
              {t.nav[key as keyof typeof t.nav]}
              <span className="absolute bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-gradient-to-r from-burgundy to-gold transition-all duration-300 group-hover:w-5" />
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-2 xl:flex">
            <button className="flex items-center gap-1.5 rounded-full border border-burgundy/15 px-4 py-1.5 text-xs font-medium text-burgundy transition-all duration-300 hover:bg-burgundy hover:text-white hover:shadow-[0_2px_16px_rgba(123,45,59,0.2)]">
              <LogIn className="h-3.5 w-3.5" />
              {t.nav.login}
            </button>
            <button className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-burgundy to-burgundy-light px-4 py-1.5 text-xs font-medium text-white shadow-[0_2px_16px_rgba(123,45,59,0.15)] transition-all duration-300 hover:shadow-[0_4px_24px_rgba(123,45,59,0.3)] hover:-translate-y-px">
              <User className="h-3.5 w-3.5" />
              {t.nav.register}
            </button>
          </div>

          <div className="hidden xl:flex">
            <LanguageSwitcher />
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 hover:bg-cream xl:hidden"
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

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 top-[7.5rem] z-40 bg-black/5 backdrop-blur-sm xl:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute left-4 right-4 top-full z-50 overflow-hidden rounded-2xl border border-border/30 bg-white/95 shadow-2xl backdrop-blur-2xl xl:hidden"
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
                <div className="mt-2 flex flex-col gap-2 border-t border-border/30 px-4 pt-3">
                  <LanguageSwitcher />
                  <button className="flex items-center justify-center gap-2 rounded-xl border border-burgundy/15 px-4 py-2.5 text-sm font-medium text-burgundy transition-all duration-200 hover:bg-burgundy hover:text-white">
                    <LogIn className="h-4 w-4" />
                    {t.nav.login}
                  </button>
                  <button className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-burgundy to-burgundy-light px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:shadow-xl">
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