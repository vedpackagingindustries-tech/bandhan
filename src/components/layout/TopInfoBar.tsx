'use client'

import { MapPin, Globe, LogIn, UserPlus, Facebook, Twitter, Instagram, Youtube } from 'lucide-react'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useTranslations } from '@/i18n'

export function TopInfoBar() {
  const { t } = useTranslations()

  return (
    <div className="relative z-50 border-b border-border/40 bg-white/60 backdrop-blur-md">
      <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left - Org Info */}
        <div className="hidden items-center gap-4 sm:flex">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
            <MapPin className="h-3 w-3 text-gold" />
            <span>{t.topBar.organization}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t.topBar.address}</span>
          </div>
        </div>

        {/* Mobile - Org only */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/70 sm:hidden">
          <MapPin className="h-3 w-3 text-gold" />
          <span>{t.topBar.organization}</span>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-3">
          {/* Social Icons */}
          <div className="hidden items-center gap-1.5 md:flex">
            {[Facebook, Twitter, Instagram, Youtube].map((Icon, idx) => (
              <a
                key={idx}
                href="#"
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/60 transition-all duration-200 hover:bg-cream hover:text-burgundy"
                aria-label="social"
              >
                <Icon className="h-3 w-3" />
              </a>
            ))}
            <span className="mx-1 text-border">|</span>
          </div>

          <LanguageSwitcher />

          <div className="hidden items-center gap-2 lg:flex">
            <button className="flex items-center gap-1 text-xs font-medium text-foreground/70 transition-colors duration-200 hover:text-burgundy">
              <LogIn className="h-3 w-3" />
              {t.nav.login}
            </button>
            <button className="flex items-center gap-1 rounded-full bg-burgundy px-3 py-1 text-xs font-medium text-white transition-all duration-200 hover:bg-burgundy-dark hover:shadow-sm">
              <UserPlus className="h-3 w-3" />
              {t.nav.register}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}